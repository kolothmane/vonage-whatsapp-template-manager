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

  const plannedTotal = Object.values(selections).reduce((sum, ids) => sum + ids.length, 0);
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

      <section className="grid gap-4">
        {wabas.map((waba) => {
          const suggested = new Set(suggestTemplatesForWaba(waba, catalogTemplates).map((template) => template.id));
          const selected = new Set(selections[waba.id] ?? []);
          return (
            <div key={waba.id} className="rounded-md border">
              <div className="flex flex-col gap-2 border-b p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-semibold">{waba.name}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{waba.id} - {selected.size} selected</p>
                </div>
                <Button type="button" variant="outline" onClick={() => restoreSuggestions(waba)}>
                  <RotateCcw className="h-4 w-4" />
                  Restore suggestions
                </Button>
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
                    {catalogTemplates.map((template) => (
                      <TableRow key={`${waba.id}-${template.id}`}>
                        <TableCell>
                          <input
                            aria-label={`Use ${template.generatedName} for ${waba.name}`}
                            checked={selected.has(template.id)}
                            className="h-4 w-4"
                            type="checkbox"
                            onChange={() => toggle(waba.id, template.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{template.generatedName}</TableCell>
                        <TableCell>{template.brand}</TableCell>
                        <TableCell>{template.language}</TableCell>
                        <TableCell>{suggested.has(template.id) ? "Suggested" : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
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
