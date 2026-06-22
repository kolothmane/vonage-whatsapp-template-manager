"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import type { TemplateRecord, Waba } from "@/lib/domain/types";
import { suggestTemplatesForWaba } from "@/lib/domain/template-suggestions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function WabaTemplateSelector({ waba, templates }: { waba: Waba; templates: TemplateRecord[] }) {
  const suggestions = useMemo(() => suggestTemplatesForWaba(waba, templates), [templates, waba]);
  const suggestedIds = useMemo(() => new Set(suggestions.map((template) => template.id)), [suggestions]);
  const [selected, setSelected] = useState<string[]>(() => suggestions.map((template) => template.id));
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function submit() {
    setState("submitting");
    setMessage("");
    try {
      const response = await fetch(`/api/wabas/${encodeURIComponent(waba.id)}/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateIds: selected }),
      });
      const result = (await response.json()) as { data?: { submitted?: number }; message?: string };
      if (!response.ok) {
        throw new Error(result.message || "Unable to submit templates.");
      }
      setState("done");
      setMessage(`${result.data?.submitted ?? 0} template(s) submitted to this WABA.`);
      setSelected([]);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit templates.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{selected.length} selected from {templates.length} catalog templates.</p>
          <p className="text-xs text-muted-foreground">{suggestions.length} suggested from the WABA brand/language tokens.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!suggestions.length} onClick={() => setSelected(suggestions.map((template) => template.id))}>
            <RefreshCw className="h-4 w-4" />
            Restore suggestions
          </Button>
          <Button disabled={!selected.length || state === "submitting"} onClick={() => void submit()}>
            <Send className="h-4 w-4" />
            {state === "submitting" ? "Submitting..." : "Submit to WABA"}
          </Button>
        </div>
      </div>
      {message ? <p className={state === "error" ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{message}</p> : null}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Select</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Language</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <input
                    aria-label={`Select ${template.generatedName}`}
                    checked={selected.includes(template.id)}
                    className="h-4 w-4"
                    onChange={() => toggle(template.id)}
                    type="checkbox"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{template.generatedName}</TableCell>
                <TableCell>{template.brand}</TableCell>
                <TableCell>{template.language}</TableCell>
                <TableCell>{template.category}</TableCell>
                <TableCell>{suggestedIds.has(template.id) ? <Badge>Suggested</Badge> : "-"}</TableCell>
              </TableRow>
            ))}
            {!templates.length ? (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                  The central catalog is empty.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
