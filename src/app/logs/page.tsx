import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLogs } from "@/lib/server/repository";
import { formatDateTime } from "@/lib/utils";

export default async function LogsPage() {
  const logs = await listLogs();

  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Submission payloads, responses, errors and duplicate blocks.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Operational Log Stream</CardTitle>
          <CardDescription>Designed for 100,000+ records with server-side pagination in production.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Import</TableHead>
                  <TableHead>WABA</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateTime(log.timestamp)}</TableCell>
                    <TableCell className="font-mono text-xs">{log.importId}</TableCell>
                    <TableCell>{log.wabaName}</TableCell>
                    <TableCell className="font-mono text-xs">{log.templateName}</TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="min-w-96 text-muted-foreground">{log.message}</TableCell>
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
