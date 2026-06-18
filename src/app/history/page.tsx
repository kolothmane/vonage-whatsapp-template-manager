import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAuditLogs } from "@/lib/server/repository";
import { formatDateTime } from "@/lib/utils";

export default async function HistoryPage() {
  const auditLogs = await listAuditLogs();

  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">Audit Trail</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every create, update, delete, submit and retry action is traceable.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
          <CardDescription>User, action, date and before/after values.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDateTime(entry.date)}</TableCell>
                    <TableCell>{entry.user}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.entity}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.oldValue ?? "-"}</TableCell>
                    <TableCell>{entry.newValue ?? "-"}</TableCell>
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
