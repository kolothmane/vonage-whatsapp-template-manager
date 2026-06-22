"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import { CheckCircle2, Copy, Download, FileJson, RefreshCw, Send, ShieldAlert, UploadCloud } from "lucide-react";
import { generateVonagePayload } from "@/lib/domain/payload";
import { generateTemplateName } from "@/lib/domain/template-name";
import { getSubmittableTemplates, validateImportRows } from "@/lib/domain/validation";
import { normalizeImportRows } from "@/lib/domain/import-normalization";
import type { TemplateRecord, ValidationReport, Waba } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const steps = ["Upload", "Preview", "Validation", "Transformation", "Review", "Submission"];

type ImportWizardProps = {
  wabas: Waba[];
  templates: TemplateRecord[];
};

export function ImportWizard({ wabas, templates }: ImportWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [targetWabaIds, setTargetWabaIds] = useState<string[]>(wabas[0] ? [wabas[0].id] : []);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [submitState, setSubmitState] = useState<"idle" | "blocked" | "submitting" | "submitted" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [parseError, setParseError] = useState("");
  const [targetError, setTargetError] = useState("");

  const transformedTemplates = useMemo(() => {
    const submittableTemplates = report ? getSubmittableTemplates(report) : [];
    return (
      submittableTemplates.map((template) => ({
        ...template,
        generatedName: overrides[template.rowNumber] || template.generatedName,
      }))
    );
  }, [overrides, report]);

  const payloads = useMemo(() => transformedTemplates.map(generateVonagePayload), [transformedTemplates]);
  const currentPayload = payloads[0] ? JSON.stringify(payloads[0], null, 2) : "";
  const rejectedRows = useMemo(
    () =>
      [...new Set(
        report?.issues
          .filter((issue) => issue.severity === "ERROR" && issue.rowNumber !== undefined)
          .map((issue) => issue.rowNumber!) ?? [],
      )].sort((a, b) => a - b),
    [report],
  );

  async function handleFile(file: File | null) {
    if (!file) {
      return;
    }

    setParseError("");
    setTargetError("");
    setFileName(file.name);
    setReport(null);
    setSubmitState("idle");
    setOverrides({});

    try {
      const parsedRows = await parseImportFile(file);
      setRows(parsedRows);
      setActiveStep(1);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Unable to parse file.");
      setRows([]);
    }
  }

  function toggleWaba(wabaId: string) {
    setTargetError("");
    setTargetWabaIds((current) => {
      if (current.includes(wabaId)) {
        const next = current.filter((id) => id !== wabaId);
        return next.length ? next : current;
      }

      return [...current, wabaId];
    });
  }

  function runValidation() {
    if (!targetWabaIds.length) {
      setTargetError("Select at least one connected WABA before validating the import.");
      return;
    }

    const validationReport = validateImportRows(rows, templates, targetWabaIds);
    setReport(validationReport);
    setSubmitState(getSubmittableTemplates(validationReport).length ? "idle" : "blocked");
    setActiveStep(2);
  }

  function bulkRegenerate() {
    if (!report) {
      return;
    }

    const regenerated: Record<number, string> = {};
    for (const template of getSubmittableTemplates(report)) {
      regenerated[template.rowNumber] = generateTemplateName(template.originalName, template.language);
    }
    setOverrides(regenerated);
    setActiveStep(3);
  }

  function copyJson() {
    void navigator.clipboard?.writeText(JSON.stringify(payloads, null, 2));
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(payloads, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName || "templates"}.vonage.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submitImport() {
    if (!targetWabaIds.length) {
      setSubmitState("error");
      setSubmitMessage("Select at least one connected WABA before submitting.");
      setActiveStep(5);
      return;
    }

    if (!payloads.length) {
      setSubmitState("blocked");
      setActiveStep(5);
      return;
    }

    setSubmitState("submitting");
    setSubmitMessage("");
    setActiveStep(5);

    try {
      const response = await fetch("/api/imports/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          rows,
          targetWabaIds,
        }),
      });
      const result = (await response.json()) as {
        data?: { savedTemplates?: number };
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "Import submission failed.");
      }

      setSubmitState("submitted");
      setSubmitMessage(`${result.data?.savedTemplates ?? payloads.length} template record(s) saved.`);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Import submission failed.");
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {steps.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => setActiveStep(index)}
                aria-current={activeStep === index ? "step" : undefined}
                className={cn(
                  "flex h-9 min-w-0 items-center rounded-md border px-2.5 text-left text-[12px] font-medium text-muted-foreground transition-colors",
                  activeStep === index && "border-primary bg-primary/12 text-primary",
                  index < activeStep && "border-emerald-400/30 text-emerald-200",
                )}
              >
                <span className="mr-1 shrink-0 font-mono">{index + 1}.</span>
                <span className="truncate">{step}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeStep === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4" />
              Upload File
            </CardTitle>
            <CardDescription>CSV, XLSX and JSON are accepted.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input accept=".csv,.xlsx,.json" type="file" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
            {parseError ? <p className="text-sm text-red-200">{parseError}</p> : null}
            <TargetSelector wabas={wabas} selected={targetWabaIds} onToggle={toggleWaba} />
            {targetError ? <p className="text-sm font-medium text-red-700">{targetError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 1 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Preview Data</CardTitle>
              <CardDescription>{fileName || "Selected file"} / {rows.length} rows</CardDescription>
            </div>
            <Button onClick={runValidation}>
              <ShieldAlert className="h-4 w-4" />
              Validate
            </Button>
          </CardHeader>
          <CardContent>
            <ImportPreview rows={rows} />
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 2 && report ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Validation</CardTitle>
              <CardDescription>
                {report.summary.errors} errors, {report.summary.warnings} warnings, {report.summary.duplicates} duplicates
              </CardDescription>
            </div>
            <Button onClick={() => setActiveStep(3)} disabled={!transformedTemplates.length}>
              <RefreshCw className="h-4 w-4" />
              Transform
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryPill label="Rows" value={report.summary.totalRows} />
              <SummaryPill label="Errors" value={report.summary.errors} tone="red" />
              <SummaryPill label="Warnings" value={report.summary.warnings} tone="amber" />
              <SummaryPill label="Duplicates" value={report.summary.duplicates} tone="red" />
            </div>
            <div className="rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
              {transformedTemplates.length} valid row(s) will continue. {rejectedRows.length} row(s) with errors will be skipped.
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Row</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.issues.length ? (
                    report.issues.map((issue, index) => (
                      <TableRow key={`${issue.code}-${index}`}>
                        <TableCell>
                          <Badge variant={issue.severity === "ERROR" ? "danger" : issue.severity === "WARNING" ? "warning" : "outline"}>
                            {issue.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">{issue.rowNumber ?? "-"}</TableCell>
                        <TableCell>{issue.field ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{issue.code}</TableCell>
                        <TableCell className="min-w-96 text-muted-foreground">{issue.message}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                        Validation passed.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 3 && report ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Transformation</CardTitle>
              <CardDescription>Generated names, language mappings and placeholder mappings.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={bulkRegenerate}>
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
              <Button onClick={() => setActiveStep(4)}>
                <FileJson className="h-4 w-4" />
                Review
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Original Name</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Generated Name</TableHead>
                    <TableHead>Body</TableHead>
                    <TableHead>Variables</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transformedTemplates.map((template) => (
                    <TableRow key={`${template.rowNumber}-${template.generatedName}`}>
                      <TableCell>{template.originalName}</TableCell>
                      <TableCell>
                        {template.language}
                        {" -> "}
                        {template.whatsappLanguage}
                      </TableCell>
                      <TableCell>
                        <Input
                          className="min-w-72 font-mono text-xs"
                          value={template.generatedName}
                          onChange={(event) =>
                            setOverrides((current) => ({ ...current, [template.rowNumber]: event.target.value }))
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-96 text-muted-foreground">{template.normalizedBody}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {template.variableMappings.map((mapping) => `${mapping.placeholder}=${mapping.key}`).join(", ") || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 4 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Review</CardTitle>
              <CardDescription>
                {payloads.length} valid payloads generated. {rejectedRows.length} row(s) with errors excluded.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyJson}>
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
              <Button variant="secondary" onClick={downloadJson}>
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button onClick={() => void submitImport()} disabled={!payloads.length || submitState === "submitting"}>
                <Send className="h-4 w-4" />
                Submit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea className="min-h-96 font-mono text-xs" readOnly value={currentPayload || "[]"} />
          </CardContent>
        </Card>
      ) : null}

      {activeStep === 5 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {submitState === "submitted" ? <CheckCircle2 className="h-4 w-4 text-emerald-200" /> : <ShieldAlert className="h-4 w-4 text-red-200" />}
              Submission
            </CardTitle>
            <CardDescription>
              {submitState === "submitted"
                ? "Valid rows were saved; rows with errors were skipped."
                : submitState === "submitting"
                  ? "Saving valid templates..."
                  : submitState === "error"
                    ? "The import could not be saved."
                    : "No valid rows are available for submission."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              {submitState === "submitted"
                ? `${submitMessage} ${rejectedRows.length} invalid row(s) skipped: ${rejectedRows.join(", ") || "none"}.`
                : submitState === "submitting"
                  ? "The server is revalidating and writing the import to Upstash."
                  : submitMessage || "Correct at least one row before submitting again."}
            </div>
            {submitState === "submitted" ? (
              <div className="mt-4 flex gap-2">
                <Link className={buttonVariants()} href="/templates">View Templates</Link>
                <Link className={buttonVariants({ variant: "outline" })} href="/imports">View Import History</Link>
              </div>
            ) : null}
            {rejectedRows.length ? (
              <div className="mt-4 overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Skipped row</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedRows.map((rowNumber) => (
                      <TableRow key={rowNumber}>
                        <TableCell className="font-mono">{rowNumber}</TableCell>
                        <TableCell>
                          {report?.issues
                            .filter((issue) => issue.severity === "ERROR" && issue.rowNumber === rowNumber)
                            .map((issue) => issue.message)
                            .join(" ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TargetSelector({
  wabas,
  selected,
  onToggle,
}: {
  wabas: Waba[];
  selected: string[];
  onToggle: (wabaId: string) => void;
}) {
  if (!wabas.length) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-amber-400/40 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-semibold text-amber-950">No connected WABA</div>
          <div className="text-amber-900">Synchronize your Vonage WABAs before validating or submitting an import.</div>
        </div>
        <Link className={buttonVariants({ variant: "outline" })} href="/wabas">
          Open WABA Management
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {wabas.map((waba) => (
        <button
          key={waba.id}
          type="button"
          onClick={() => onToggle(waba.id)}
          className={cn(
            "rounded-md border p-3 text-left text-sm transition-colors hover:bg-secondary",
            selected.includes(waba.id) && "border-primary bg-primary/12",
          )}
        >
          <span className="block font-medium">{waba.name}</span>
          <span className="mt-1 block font-mono text-xs text-muted-foreground">{waba.id}</span>
        </button>
      ))}
    </div>
  );
}

function ImportPreview({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Object.keys(rows[0] ?? {}).filter((column) => !column.startsWith("__")).slice(0, 8);

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 10).map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column} className="min-w-40">
                  {String(row[column] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryPill({ label, value, tone = "green" }: { label: string; value: number; tone?: "green" | "amber" | "red" }) {
  const toneClass = {
    green: "border-emerald-400/20 bg-emerald-400/10",
    amber: "border-amber-400/20 bg-amber-400/10",
    red: "border-red-400/20 bg-red-400/10",
  }[tone];

  return (
    <div className={cn("rounded-md border p-3", toneClass)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
    </div>
  );
}

async function parseImportFile(file: File): Promise<Record<string, unknown>[]> {
  if (file.name.endsWith(".json")) {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeImportRows(parsed as Record<string, unknown>[]);
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { templates?: unknown[] }).templates)) {
      return normalizeImportRows((parsed as { templates: Record<string, unknown>[] }).templates);
    }
    throw new Error("JSON must be an array or contain a templates array.");
  }

  if (file.name.endsWith(".xlsx")) {
    const sheetRows = await readSheet(file);
    const [headerRow, ...dataRows] = sheetRows;
    const headers = (headerRow ?? []).map((value) => String(value ?? ""));

    return normalizeImportRows(
      dataRows
      .filter((row) => row.some((value) => value !== null && value !== ""))
      .map((row) =>
        Object.fromEntries(headers.map((header, index) => [header.trim(), row[index] ?? ""])),
      ),
    );
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message);
  }

  return normalizeImportRows(parsed.data);
}
