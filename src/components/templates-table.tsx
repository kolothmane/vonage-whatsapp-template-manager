"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Pencil, Search, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUPPORTED_BRANDS, SUPPORTED_LANGUAGES, TEMPLATE_CATEGORIES, type TemplateRecord } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/utils";

export function TemplatesTable({ templates }: { templates: TemplateRecord[] }) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<TemplateRecord | null>(null);
  const [actionState, setActionState] = useState<"idle" | "working" | "error">("idle");
  const [actionMessage, setActionMessage] = useState("");
  const brands = useMemo(() => [...new Set(templates.map((template) => template.brand))].sort(), [templates]);
  const languages = useMemo(() => [...new Set(templates.map((template) => template.language))].sort(), [templates]);
  const statuses = useMemo(() => [...new Set(templates.map((template) => template.status))].sort(), [templates]);
  const locations = useMemo(
    () => [...new Set(templates.map((template) => template.wabaName || "Catalog"))].sort(),
    [templates],
  );
  const filteredTemplates = useMemo(
    () =>
      templates.filter(
        (template) =>
          (brandFilter === "ALL" || template.brand === brandFilter) &&
          (languageFilter === "ALL" || template.language === languageFilter) &&
          (statusFilter === "ALL" || template.status === statusFilter) &&
          (locationFilter === "ALL" || (template.wabaName || "Catalog") === locationFilter),
      ),
    [brandFilter, languageFilter, locationFilter, statusFilter, templates],
  );

  const columns = useMemo<ColumnDef<TemplateRecord>[]>(
    () => [
      {
        id: "select",
        header: "Select",
        cell: ({ row }) => (
          <input
            aria-label={`Select ${row.original.generatedName}`}
            checked={selected.includes(row.original.id)}
            className="h-4 w-4"
            onChange={() =>
              setSelected((current) =>
                current.includes(row.original.id)
                  ? current.filter((id) => id !== row.original.id)
                  : [...current, row.original.id],
              )
            }
            type="checkbox"
          />
        ),
      },
      {
        accessorKey: "generatedName",
        header: ({ column }) => (
          <Button variant="ghost" size="sm" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Generated Name
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.generatedName}</span>,
      },
      {
        accessorKey: "brand",
        header: "Brand",
      },
      {
        accessorKey: "language",
        header: "Language",
      },
      {
        accessorKey: "wabaName",
        header: "Location",
        cell: ({ row }) => row.original.wabaName || "Catalog",
      },
      {
        accessorKey: "category",
        header: "Category",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => formatDateTime(row.original.updatedAt),
      },
    ],
    [selected],
  );

  const table = useReactTable({
    data: filteredTemplates,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });
  const filteredIds = table.getFilteredRowModel().rows.map((row) => row.original.id);
  const pageIds = table.getRowModel().rows.map((row) => row.original.id);

  function selectIds(ids: string[]) {
    setSelected((current) => [...new Set([...current, ...ids])]);
  }

  async function deleteSelected() {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected template(s)? This action cannot be undone.`)) return;
    setActionState("working");
    setActionMessage("");
    try {
      const response = await fetch("/api/templates/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const result = (await response.json()) as { data?: { deleted?: number }; message?: string };
      if (!response.ok) throw new Error(result.message || "Unable to delete templates.");
      setSelected([]);
      setEditing(null);
      setActionState("idle");
      setActionMessage(`${result.data?.deleted ?? 0} template(s) deleted.`);
      router.refresh();
    } catch (error) {
      setActionState("error");
      setActionMessage(error instanceof Error ? error.message : "Unable to delete templates.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_repeat(4,minmax(130px,170px))]">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search generated name, brand, language or location"
          />
        </div>
        <TemplateSelect label="Brand" value={brandFilter} values={brands} onChange={setBrandFilter} />
        <TemplateSelect label="Language" value={languageFilter} values={languages} onChange={setLanguageFilter} />
        <TemplateSelect label="Status" value={statusFilter} values={statuses} onChange={setStatusFilter} />
        <TemplateSelect label="Location" value={locationFilter} values={locations} onChange={setLocationFilter} />
      </div>
      <div className="text-sm text-muted-foreground">
        {table.getFilteredRowModel().rows.length} of {templates.length} templates
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => selectIds(pageIds)} disabled={!pageIds.length}>Select page</Button>
        <Button variant="outline" size="sm" onClick={() => selectIds(filteredIds)} disabled={!filteredIds.length}>Select all filtered</Button>
        <Button variant="ghost" size="sm" onClick={() => setSelected([])} disabled={!selected.length}>Clear selection</Button>
        <Button
          variant="outline"
          size="sm"
          disabled={selected.length !== 1}
          onClick={() => setEditing(templates.find((template) => template.id === selected[0]) ?? null)}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button variant="destructive" size="sm" disabled={!selected.length || actionState === "working"} onClick={() => void deleteSelected()}>
          <Trash2 className="h-4 w-4" />
          Delete {selected.length || ""}
        </Button>
        <span className="text-xs text-muted-foreground">{selected.length} selected</span>
      </div>
      {actionMessage ? <p className={actionState === "error" ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{actionMessage}</p> : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No templates match this search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
        </span>
        <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {editing ? (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSelected([]);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: TemplateRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    brand: template.brand,
    language: template.language,
    originalName: template.originalName,
    body: template.body,
    category: template.category,
    automation: template.automation,
    bodyVariables: template.variableMappings.map((item) => `${item.placeholder} ${item.source}`).join("\n"),
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/templates/${encodeURIComponent(template.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      setSaving(false);
      setMessage(result.message || "Unable to update template.");
      return;
    }
    onSaved();
  }

  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Edit Template</h3>
          <p className="font-mono text-xs text-muted-foreground">{template.generatedName}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EditorSelect label="Brand" value={form.brand} values={[...SUPPORTED_BRANDS]} onChange={(brand) => setForm({ ...form, brand: brand as TemplateRecord["brand"] })} />
        <EditorSelect label="Language" value={form.language} values={[...SUPPORTED_LANGUAGES]} onChange={(language) => setForm({ ...form, language: language as TemplateRecord["language"] })} />
        <label className="grid gap-1 text-sm">Template Name<Input value={form.originalName} onChange={(event) => setForm({ ...form, originalName: event.target.value })} /></label>
        <EditorSelect label="Category" value={form.category} values={[...TEMPLATE_CATEGORIES]} onChange={(category) => setForm({ ...form, category: category as TemplateRecord["category"] })} />
        <label className="grid gap-1 text-sm">Automation<Input value={form.automation} onChange={(event) => setForm({ ...form, automation: event.target.value })} /></label>
        <label className="grid gap-1 text-sm">Body Variables<textarea className="min-h-24 rounded-md border p-3 text-sm" value={form.bodyVariables} onChange={(event) => setForm({ ...form, bodyVariables: event.target.value })} /></label>
      </div>
      <label className="grid gap-1 text-sm">Template Body<textarea className="min-h-40 rounded-md border p-3 text-sm" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save changes"}</Button>
      </div>
    </div>
  );
}

function EditorSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select className="h-10 rounded-md border bg-white px-3" value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

function TemplateSelect({
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
    <label>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="h-10 w-full rounded-md border bg-white px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="ALL">All {label.toLowerCase()}s</option>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}
