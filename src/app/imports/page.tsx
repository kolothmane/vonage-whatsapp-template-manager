import { RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listImports } from "@/lib/server/repository";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default async function ImportsPage() {
  const imports = await listImports();

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Imports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track queue progress, resumable batches and retry scopes.</p>
        </div>
        <Button variant="outline">
          <RotateCcw className="h-4 w-4" />
          Retry All Failed
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <CardDescription>Filter by date, WABA, brand, language and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Import ID</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Duplicates</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.id}</TableCell>
                    <TableCell className="font-medium">{item.fileName}</TableCell>
                    <TableCell>{item.target}</TableCell>
                    <TableCell className="font-mono text-xs">{item.mode}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="font-mono">{formatNumber(item.total)}</TableCell>
                    <TableCell className="font-mono">{formatNumber(item.submitted)}</TableCell>
                    <TableCell className="font-mono">{formatNumber(item.failed)}</TableCell>
                    <TableCell className="font-mono">{formatNumber(item.skipped)}</TableCell>
                    <TableCell className="font-mono">{formatNumber(item.duplicates)}</TableCell>
                    <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
