import { RefreshCw, Search } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listWabas } from "@/lib/server/repository";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default async function WabasPage() {
  const wabas = await listWabas();

  return (
    <div className="grid gap-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">WABA Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Search, sort, select and synchronize connected accounts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RefreshCw className="h-4 w-4" />
            Refresh WABAs
          </Button>
          <Button>
            <RefreshCw className="h-4 w-4" />
            Sync Templates
          </Button>
        </div>
      </section>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by WABA name, ID or country" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected WABAs</CardTitle>
          <CardDescription>Bulk actions are designed for hundreds of WABAs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input aria-label="Select all WABAs" type="checkbox" className="h-4 w-4 rounded border bg-input" />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>WABA ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Template Count</TableHead>
                  <TableHead>Last Sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wabas.map((waba) => (
                  <TableRow key={waba.id}>
                    <TableCell>
                      <input aria-label={`Select ${waba.name}`} type="checkbox" className="h-4 w-4 rounded border bg-input" />
                    </TableCell>
                    <TableCell className="font-medium">{waba.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{waba.id}</TableCell>
                    <TableCell>
                      <StatusBadge status={waba.status} />
                    </TableCell>
                    <TableCell>{waba.country}</TableCell>
                    <TableCell className="font-mono">{formatNumber(waba.templateCount)}</TableCell>
                    <TableCell>{formatDateTime(waba.lastSyncAt)}</TableCell>
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
