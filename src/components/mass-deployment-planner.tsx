"use client";

import { useMemo, useState } from "react";
import { Play, Plus, RotateCcw } from "lucide-react";
import type { MassDeploymentRecord, TemplateRecord, Waba } from "@/lib/domain/types";
import { suggestTemplatesForWaba } from "@/lib/domain/template-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatNumber } from "@/lib/utils";

type SelectionState = Record<string, string[]>;

export function MassDeploymentPlanner({
  wabas,
  templates,
  deployments,
  activeEnvironmentId,
}: {
  wabas: Waba[];
  templates: TemplateRecord[];
  deployments: MassDeploymentRecord[];
  activeEnvironmentId: string;
}) {
  const catalogTemplates = useMemo(() => templates.filter((template) => !template.wabaId), [templates]);
  const [name, setName] = useState(`Mass deployment ${new Date().toISOString().slice(0, 10)}`);
  const [batchSize, setBatchSize] = useState(100);
  const [selections, setSelections] = useState<SelectionState>(() => {
    const initial: SelectionState = {};
    for (const waba of wabas) {
      initial[waba.id] = suggestTemplatesForWaba(waba, catalogTemplates).map((template) => template.id);
    }
    return initial;
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [templateQueries, setTemplateQueries] = useState<Record<string, string>>({});
  const [wabaQuery, setWabaQuery] = useState("");
  const [activeWabaId, setActiveWabaId] = useState(wabas[0]?.id ?? "");

  const plannedTotal = Object.values(selections).reduce((sum, ids) => sum + ids.length, 0);
  const wabaById = useMemo(() => new Map(wabas.map((waba) => [waba.id, waba])), [wabas]);
  const filteredWabas = useMemo(() => {
    const normalized = wabaQuery.trim().toLowerCase();
    if (!normalized) return wabas;
    return wabas.filter((waba) =>
      [
        waba.id,
        waba.name,
        waba.brand ?? "",
        waba.country,
        waba.languagePriority ?? "",
      ].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [wabaQuery, wabas]);
  const activeWaba = wabaById.get(activeWabaId) ?? filteredWabas[0] ?? wabas[0];
  const cronUrl = activeEnvironmentId
    ? `https://vonage-whatsapp-template-manager.vercel.app/api/cron/mass-deploy?environmentId=${encodeURIComponent(activeEnvironmentId)}&limit=100`
    : "";

  function toggle(wabaId: string, templateId: string) {
    setSelections((current) => {
      const currentIds = current[wabaId] ?? [];
      return {
        ...current,
        [wabaId]: currentIds.includes(templateId)
          ? currentIds.filter((id) => id !== templateId)
          : [...currentIds, templateId],
      };
    });
  }

  function restoreSuggestions(waba: Waba) {
    setSelections((current) => ({
      ...current,
      [waba.id]: suggestTemplatesForWaba(waba, catalogTemplates).map((template) => template.id),
    }));
  }

  function wabaDisplayName(waba: Waba) {
    const metadata = [waba.brand, waba.country !== "Unknown" ? waba.country : ""].filter(Boolean).join(" ");
    if (!metadata) return waba.name;
    return waba.name === metadata || waba.name.endsWith(` ${metadata}`) ? waba.name : `${waba.name} ${metadata}`;
  }

  function matchesTemplateQuery(template: TemplateRecord, query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [
      template.generatedName,
      template.originalName,
      template.brand,
      template.language,
      template.automation,
    ].some((value) => value.toLowerCase().includes(normalized));
  }

  async function createPlan() {
    setBusy(true);
    setMessage("");
    try {
      const wabaTemplateIds = Object.fromEntries(
        Object.entries(selections).filter(([, ids]) => ids.length > 0),
      );
      const response = await fetch("/api/mass-deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, batchSize, wabaTemplateIds }),
      });
      const result = (await response.json()) as { data?: { deployment?: MassDeploymentRecord; items?: unknown[] }; message?: string };
      if (!response.ok) throw new Error(result.message || "Unable to create deployment plan.");
      setMessage(`Draft created with ${result.data?.items?.length ?? plannedTotal} queued template submission(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create deployment plan.");
    } finally {
      setBusy(false);
    }
  }

  async function startPlan(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/mass-deployments/${encodeURIComponent(id)}/start`, { method: "POST" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Unable to start deployment.");
      setMessage("Deployment marked as running. The next scheduler call will process up to 100 templates.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start deployment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-md border p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_auto] md:items-end">
          <label className="grid gap-1 text-sm">
            Deployment name
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Hourly batch size
            <Input
              min={1}
              max={100}
              type="number"
              value={batchSize}
              onChange={(event) => setBatchSize(Math.max(1, Math.min(100, Number(event.target.value) || 100)))}
            />
          </label>
          <Button disabled={!plannedTotal || busy} onClick={() => void createPlan()}>
            <Plus className="h-4 w-4" />
            Create draft
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{formatNumber(plannedTotal)} planned submission(s). No template is submitted until a draft is started and the scheduler runs.</p>
        {cronUrl ? <p className="break-all font-mono text-xs text-muted-foreground">Scheduler URL: {cronUrl}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-md border">
          <div className="border-b p-4">
            <h2 className="font-semibold">WABAs</h2>
            <Input
              className="mt-3"
              placeholder="Search WABA, brand, country"
              value={wabaQuery}
              onChange={(event) => setWabaQuery(event.target.value)}
            />
          </div>
          <div className="max-h-[680px] overflow-auto">
            {filteredWabas.map((waba) => {
              const selectedCount = selections[waba.id]?.length ?? 0;
              const active = waba.id === activeWaba?.id;
              return (
                <button
                  key={waba.id}
                  type="button"
                  className={active ? "block w-full border-b bg-secondary p-3 text-left" : "block w-full border-b p-3 text-left hover:bg-secondary/60"}
                  onClick={() => setActiveWabaId(waba.id)}
                >
                  <span className="block truncate text-sm font-medium">{wabaDisplayName(waba)}</span>
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">
                    {waba.id} - {selectedCount} selected
                  </span>
                </button>
              );
            })}
            {!filteredWabas.length ? (
              <div className="p-4 text-sm text-muted-foreground">No WABA matches this search.</div>
            ) : null}
          </div>
        </div>

        {activeWaba ? (() => {
          const suggested = new Set(suggestTemplatesForWaba(activeWaba, catalogTemplates).map((template) => template.id));
          const selected = new Set(selections[activeWaba.id] ?? []);
          const templateQuery = templateQueries[activeWaba.id] ?? "";
          const matchingTemplates = catalogTemplates
            .filter((template) => matchesTemplateQuery(template, templateQuery))
            .sort((left, right) => {
              const leftSelected = selected.has(left.id) ? 1 : 0;
              const rightSelected = selected.has(right.id) ? 1 : 0;
              if (leftSelected !== rightSelected) return rightSelected - leftSelected;

              const leftSuggested = suggested.has(left.id) ? 1 : 0;
              const rightSuggested = suggested.has(right.id) ? 1 : 0;
              if (leftSuggested !== rightSuggested) return rightSuggested - leftSuggested;

              return left.generatedName.localeCompare(right.generatedName);
            });
          const visibleTemplates = matchingTemplates.slice(0, 250);
          const matchCount = matchingTemplates.length;
          return (
            <div key={activeWaba.id} className="rounded-md border">
              <div className="flex flex-col gap-2 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold">{wabaDisplayName(activeWaba)}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{activeWaba.id} - {selected.size} selected</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Input
                    className="sm:w-72"
                    placeholder="Search template name"
                    value={templateQuery}
                    onChange={(event) => setTemplateQueries((current) => ({
                      ...current,
                      [activeWaba.id]: event.target.value,
                    }))}
                  />
                  <Button type="button" variant="outline" onClick={() => restoreSuggestions(activeWaba)}>
                    <RotateCcw className="h-4 w-4" />
                    Restore suggestions
                  </Button>
                </div>
              </div>
              <div className="border-b px-4 py-2 text-xs text-muted-foreground">
                Showing {formatNumber(visibleTemplates.length)} of {formatNumber(matchCount)} matching template(s). Use search to narrow large catalogs.
              </div>
              <div className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Use</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTemplates.map((template) => (
                      <TableRow key={`${activeWaba.id}-${template.id}`}>
                        <TableCell>
                          <input
                            aria-label={`Use ${template.generatedName} for ${activeWaba.name}`}
                            checked={selected.has(template.id)}
                            className="h-4 w-4"
                            type="checkbox"
                            onChange={() => toggle(activeWaba.id, template.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{template.generatedName}</TableCell>
                        <TableCell>{template.brand}</TableCell>
                        <TableCell>{template.language}</TableCell>
                        <TableCell>{suggested.has(template.id) ? "Suggested" : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {!visibleTemplates.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                          No template matches this search.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })() : (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">No WABA available.</div>
        )}
      </section>

      <section className="rounded-md border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Deployment plans</h2>
          <a className="text-sm underline" href="/api/mass-deployments/submission-errors?format=csv">Download submission errors</a>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Queued</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell className="font-medium">{deployment.name}</TableCell>
                  <TableCell><StatusBadge status={deployment.status} /></TableCell>
                  <TableCell className="font-mono">{deployment.total}</TableCell>
                  <TableCell className="font-mono">{deployment.queued}</TableCell>
                  <TableCell className="font-mono">{deployment.submitted}</TableCell>
                  <TableCell className="font-mono">{deployment.failed}</TableCell>
                  <TableCell>{formatDateTime(deployment.updatedAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" disabled={deployment.status !== "Draft" || busy} onClick={() => void startPlan(deployment.id)}>
                      <Play className="h-4 w-4" />
                      Start
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!deployments.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-20 text-center text-muted-foreground">No deployment plans yet.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
