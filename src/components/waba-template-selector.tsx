"use client";

import { useMemo, useState } from "react";
import { Pencil, RefreshCw, Send } from "lucide-react";
import {
  SUPPORTED_BRANDS,
  SUPPORTED_LANGUAGES,
  TEMPLATE_CATEGORIES,
  type TemplateRecord,
  type Waba,
} from "@/lib/domain/types";
import { suggestTemplatesForWaba } from "@/lib/domain/template-suggestions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function WabaTemplateSelector({ waba, templates }: { waba: Waba; templates: TemplateRecord[] }) {
  const [catalogTemplates, setCatalogTemplates] = useState(templates);
  const [editing, setEditing] = useState<TemplateRecord | null>(null);
  const suggestions = useMemo(() => suggestTemplatesForWaba(waba, catalogTemplates), [catalogTemplates, waba]);
  const suggestedIds = useMemo(() => new Set(suggestions.map((template) => template.id)), [suggestions]);
  const [selected, setSelected] = useState<string[]>(() => suggestions.map((template) => template.id));
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const brands = useMemo(() => [...new Set(catalogTemplates.map((template) => template.brand))].sort(), [catalogTemplates]);
  const languages = useMemo(() => [...new Set(catalogTemplates.map((template) => template.language))].sort(), [catalogTemplates]);
  const visibleTemplates = useMemo(
    () =>
      catalogTemplates.filter(
        (template) =>
          (brandFilter === "ALL" || template.brand === brandFilter) &&
          (languageFilter === "ALL" || template.language === languageFilter),
      ),
    [brandFilter, catalogTemplates, languageFilter],
  );

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
          <p className="text-sm text-muted-foreground">{selected.length} selected from {catalogTemplates.length} catalog templates.</p>
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Brand
          <select
            className="h-9 min-w-40 rounded-md border bg-white px-3 text-sm text-foreground"
            value={brandFilter}
            onChange={(event) => setBrandFilter(event.target.value)}
          >
            <option value="ALL">All brands</option>
            {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Language
          <select
            className="h-9 min-w-40 rounded-md border bg-white px-3 text-sm text-foreground"
            value={languageFilter}
            onChange={(event) => setLanguageFilter(event.target.value)}
          >
            <option value="ALL">All languages</option>
            {languages.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        </label>
        <p className="pb-2 text-xs text-muted-foreground">{visibleTemplates.length} template(s) shown.</p>
      </div>
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
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleTemplates.map((template) => (
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
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(template)}
                    aria-label={`Edit ${template.generatedName}`}
                    title="Edit template"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!visibleTemplates.length ? (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={7}>
                  No catalog templates match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {editing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md bg-white shadow-xl">
            <WabaTemplateEditor
              template={editing}
              onClose={() => setEditing(null)}
              onSaved={(updated) => {
                setCatalogTemplates((current) =>
                  current.map((template) => template.id === updated.id ? updated : template),
                );
                setEditing(null);
                setMessage("Template updated. The corrected version will be used for submission.");
                setState("done");
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WabaTemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: TemplateRecord;
  onClose: () => void;
  onSaved: (template: TemplateRecord) => void;
}) {
  const [form, setForm] = useState({
    brand: template.brand,
    language: template.language,
    originalName: template.originalName,
    body: template.body,
    category: template.category,
    automation: template.automation,
    bodyVariables: template.variableMappings
      .map((item) => `${item.placeholder} ${item.source}`)
      .join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/templates/${encodeURIComponent(template.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { data?: TemplateRecord; message?: string };
      if (!response.ok || !result.data) {
        throw new Error(result.message || "Unable to update template.");
      }
      onSaved(result.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update template.");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Edit template</h2>
          <p className="font-mono text-xs text-muted-foreground">{template.generatedName}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EditorSelect label="Brand" value={form.brand} values={[...SUPPORTED_BRANDS]} onChange={(brand) => setForm({ ...form, brand: brand as TemplateRecord["brand"] })} />
        <EditorSelect label="Language" value={form.language} values={[...SUPPORTED_LANGUAGES]} onChange={(language) => setForm({ ...form, language: language as TemplateRecord["language"] })} />
        <label className="grid gap-1 text-sm">
          Template Name
          <Input value={form.originalName} onChange={(event) => setForm({ ...form, originalName: event.target.value })} />
        </label>
        <EditorSelect label="Category" value={form.category} values={[...TEMPLATE_CATEGORIES]} onChange={(category) => setForm({ ...form, category: category as TemplateRecord["category"] })} />
        <label className="grid gap-1 text-sm">
          Automation
          <Input value={form.automation} onChange={(event) => setForm({ ...form, automation: event.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">
          Body Variables
          <Textarea className="min-h-24" value={form.bodyVariables} onChange={(event) => setForm({ ...form, bodyVariables: event.target.value })} />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        Template Body
        <Textarea className="min-h-48" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
      </label>
      {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function EditorSelect({
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
    <label className="grid gap-1 text-sm">
      {label}
      <select
        className="h-10 rounded-md border bg-white px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}
