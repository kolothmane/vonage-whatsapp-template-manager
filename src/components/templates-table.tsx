"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { TemplateRecord } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/utils";

export function TemplatesTable({ templates }: { templates: TemplateRecord[] }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [languageFilter, setLanguageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
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
    [],
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
    </div>
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
