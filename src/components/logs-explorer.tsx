"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { LogRecord } from "@/lib/domain/types";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export function LogsExplorer({ logs }: { logs: LogRecord[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [brand, setBrand] = useState("ALL");
  const [language, setLanguage] = useState("ALL");
  const statuses = useMemo(() => [...new Set(logs.map((log) => log.status))].sort(), [logs]);
  const brands = useMemo(() => [...new Set(logs.map((log) => log.brand))].sort(), [logs]);
  const languages = useMemo(() => [...new Set(logs.map((log) => log.language))].sort(), [logs]);
  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesQuery =
        !normalizedQuery ||
        [log.importId, log.wabaId, log.wabaName, log.templateName, log.message, log.actorName, log.actorEmail]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (status === "ALL" || log.status === status) &&
        (brand === "ALL" || log.brand === brand) &&
        (language === "ALL" || log.language === language)
      );
    });
  }, [brand, language, logs, query, status]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_repeat(3,minmax(130px,180px))]">
        <label className="relative">
          <span className="sr-only">Search logs</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search template, WABA, import ID or message"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <LogSelect label="Status" value={status} onChange={setStatus} values={statuses} />
        <LogSelect label="Brand" value={brand} onChange={setBrand} values={brands} />
        <LogSelect label="Language" value={language} onChange={setLanguage} values={languages} />
      </div>

      <div className="text-xs text-muted-foreground">{visibleLogs.length} of {logs.length} log entries shown.</div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Import</TableHead>
              <TableHead>WABA</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                <TableCell className="font-mono text-xs">{log.importId || "-"}</TableCell>
                <TableCell>{log.wabaName || "-"}</TableCell>
                <TableCell className="font-mono text-xs">{log.templateName}</TableCell>
                <TableCell>
                  <div>{log.actorName || (log.actorEmail ? "User" : "System")}</div>
                  <div className="text-xs text-muted-foreground">{log.actorEmail || (log.actorName ? "" : "Automated action")}</div>
                </TableCell>
                <TableCell><StatusBadge status={log.status} /></TableCell>
                <TableCell className="min-w-80 text-muted-foreground">{log.message}</TableCell>
              </TableRow>
            ))}
            {!visibleLogs.length ? (
              <TableRow>
                <TableCell className="h-24 text-center text-muted-foreground" colSpan={7}>
                  No logs match the current search and filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LogSelect({
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
