"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Eye, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import type { ApiLogRecord, MassDeploymentItem, MassDeploymentRecord, SubmissionErrorRecord, TemplateRecord, Waba } from "@/lib/domain/types";
import { suggestTemplatesForWaba } from "@/lib/domain/template-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime, formatNumber } from "@/lib/utils";

type SelectionState = Record<string, string[]>;
type DeploymentApiCallsState = {
  deployment?: MassDeploymentRecord;
  logs: ApiLogRecord[];
  refreshedAt?: string;
};

const GITHUB_CRON_INTERVAL_HOURS = 2;

function TemplateFilterSelect({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground sm:w-36">
      {label}
      <select
        className="h-10 rounded-md border bg-white px-3 text-sm text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="ALL">All</option>
        {values.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function getNextCronDate(now: Date) {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  const currentHour = now.getUTCHours();
  const nextHour = currentHour - (currentHour % GITHUB_CRON_INTERVAL_HOURS) + GITHUB_CRON_INTERVAL_HOURS;
  next.setUTCHours(nextHour);
  return next;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function MassDeploymentPlanner({
  wabas,
  templates,
  deployments,
  deploymentItems,
  submissionErrors,
  activeEnvironmentId,
}: {
  wabas: Waba[];
  templates: TemplateRecord[];
  deployments: MassDeploymentRecord[];
  deploymentItems: MassDeploymentItem[];
  submissionErrors: SubmissionErrorRecord[];
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
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [visibleApiCallsDeploymentId, setVisibleApiCallsDeploymentId] = useState("");
  const [apiCalls, setApiCalls] = useState<DeploymentApiCallsState>({ logs: [] });
  const [apiCallsMessage, setApiCallsMessage] = useState("");
  const [now, setNow] = useState(() => new Date());

  const plannedTotal = Object.values(selections).reduce((sum, ids) => sum + ids.length, 0);
  const recentSubmittedItems = useMemo(
    () => [...deploymentItems]
      .filter((item) => item.status === "Submitted")
      .sort((left, right) =>
        (right.lastAttemptAt ?? right.submittedAt ?? "").localeCompare(left.lastAttemptAt ?? left.submittedAt ?? ""),
      )
      .slice(0, 25),
    [deploymentItems],
  );
  const recentSubmissionErrors = useMemo(
    () => [...submissionErrors].sort((left, right) => right.timestamp.localeCompare(left.timestamp)).slice(0, 25),
    [submissionErrors],
  );
  const brands = useMemo(() => [...new Set(catalogTemplates.map((template) => template.brand))].sort(), [catalogTemplates]);
  const languages = useMemo(() => [...new Set(catalogTemplates.map((template) => template.language))].sort(), [catalogTemplates]);
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
  const nextCronDate = useMemo(() => getNextCronDate(now), [now]);
  const nextCronCountdown = formatDuration(nextCronDate.getTime() - now.getTime());

  const visibleApiCallsDeployment = useMemo(
    () => deployments.find((deployment) => deployment.id === visibleApiCallsDeploymentId),
    [deployments, visibleApiCallsDeploymentId],
  );

  useEffect(() => {
    if (!visibleApiCallsDeploymentId) return;
    let cancelled = false;

    async function loadApiCalls() {
      try {
        const response = await fetch(`/api/mass-deployments/${encodeURIComponent(visibleApiCallsDeploymentId)}/api-calls`, {
          cache: "no-store",
        });
        const result = (await response.json()) as { data?: DeploymentApiCallsState; message?: string };
        if (!response.ok) throw new Error(result.message || "Unable to load API calls.");
        if (!cancelled) {
          setApiCalls(result.data ?? { logs: [] });
          setApiCallsMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setApiCallsMessage(error instanceof Error ? error.message : "Unable to load API calls.");
        }
      }
    }

    void loadApiCalls();
    const interval = window.setInterval(() => void loadApiCalls(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [visibleApiCallsDeploymentId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

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
      setMessage("Deployment marked as running. The first batch starts now; the scheduler will process the next batches.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start deployment.");
    } finally {
      setBusy(false);
    }
  }

  async function pausePlan(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/mass-deployments/${encodeURIComponent(id)}/pause`, { method: "POST" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Unable to pause deployment.");
      setMessage("Deployment paused. The scheduler will ignore it until it is started again.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to pause deployment.");
    } finally {
      setBusy(false);
    }
  }

  function showApiCalls(id: string) {
    setVisibleApiCallsDeploymentId(id);
    setApiCalls({ logs: [] });
    setApiCallsMessage("");
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
            .filter((template) =>
              matchesTemplateQuery(template, templateQuery) &&
              (brandFilter === "ALL" || template.brand === brandFilter) &&
              (languageFilter === "ALL" || template.language === languageFilter)
            )
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
                  <TemplateFilterSelect label="Brand" value={brandFilter} values={brands} onChange={setBrandFilter} />
                  <TemplateFilterSelect label="Language" value={languageFilter} values={languages} onChange={setLanguageFilter} />
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
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <h2 className="font-semibold">Deployment plans</h2>
            <div className="inline-flex w-fit items-center gap-2 rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Next cron in {nextCronCountdown}
            </div>
          </div>
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
                <TableHead className="w-56">Action</TableHead>
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
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={!["Draft", "Paused"].includes(deployment.status) || busy} onClick={() => void startPlan(deployment.id)}>
                        <Play className="h-4 w-4" />
                        Start
                      </Button>
                      <Button size="sm" variant="outline" disabled={deployment.status !== "Running" || busy} onClick={() => void pausePlan(deployment.id)}>
                        <Pause className="h-4 w-4" />
                        Pause
                      </Button>
                      {deployment.status === "Running" ? (
                        <Button size="sm" variant="outline" onClick={() => showApiCalls(deployment.id)}>
                          <Eye className="h-4 w-4" />
                          Voir appels
                        </Button>
                      ) : null}
                    </div>
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

      {visibleApiCallsDeployment ? (
        <section className="rounded-md border">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">Appels API live</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {visibleApiCallsDeployment.name} · rafraichi toutes les 5 secondes
                {apiCalls.refreshedAt ? ` · dernier refresh ${formatDateTime(apiCalls.refreshedAt)}` : ""}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setVisibleApiCallsDeploymentId("")}>
              <X className="h-4 w-4" />
              Fermer
            </Button>
          </div>
          {apiCallsMessage ? <div className="border-b p-4 text-sm text-red-700">{apiCallsMessage}</div> : null}
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>WABA</TableHead>
                  <TableHead>Response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiCalls.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(log.timestamp)}</TableCell>
                    <TableCell className="font-mono text-xs">{log.method}</TableCell>
                    <TableCell className="max-w-80 truncate font-mono text-xs" title={log.endpoint}>
                      {log.endpoint}
                    </TableCell>
                    <TableCell>
                      <span className={log.ok ? "text-emerald-700" : "text-red-700"}>
                        {log.status ?? "ERR"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.durationMs} ms</TableCell>
                    <TableCell className="font-mono text-xs">{log.wabaId ?? "-"}</TableCell>
                    <TableCell className="max-w-96 truncate text-xs text-muted-foreground" title={log.errorMessage ?? log.responseSummary ?? ""}>
                      {log.errorMessage ?? log.responseSummary ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {!apiCalls.logs.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      Aucun appel API récent pour ce deployment. Les appels apparaitront ici au prochain passage du scheduler.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border">
          <div className="border-b p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Recent successful submissions</h2>
                <p className="mt-1 text-xs text-muted-foreground">Only templates successfully submitted by mass deployments.</p>
              </div>
              <a className="text-sm underline" href="/api/mass-deployments/submitted?format=csv">CSV</a>
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>WABA</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Attempts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSubmittedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDateTime(item.submittedAt ?? item.lastAttemptAt ?? "")}</TableCell>
                    <TableCell className="font-mono text-xs">{item.wabaName}</TableCell>
                    <TableCell className="font-mono text-xs">{item.templateName}</TableCell>
                    <TableCell className="font-mono text-xs">{item.attempts}</TableCell>
                  </TableRow>
                ))}
                {!recentSubmittedItems.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No successful submission yet.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="font-semibold">Recent submission errors</h2>
              <p className="mt-1 text-xs text-muted-foreground">Failed rows are written here and to the CSV export.</p>
            </div>
            <a className="text-sm underline" href="/api/mass-deployments/submission-errors?format=csv">CSV</a>
          </div>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>WABA</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSubmissionErrors.map((error) => (
                  <TableRow key={error.id}>
                    <TableCell>{formatDateTime(error.timestamp)}</TableCell>
                    <TableCell className="font-mono text-xs">{error.wabaName}</TableCell>
                    <TableCell className="font-mono text-xs">{error.templateName}</TableCell>
                    <TableCell className="max-w-80 truncate text-xs text-red-700" title={error.errorMessage}>
                      {error.errorCode ? `${error.errorCode}: ` : ""}{error.errorMessage}
                    </TableCell>
                  </TableRow>
                ))}
                {!recentSubmissionErrors.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No submission errors yet.</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}
