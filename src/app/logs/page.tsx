import { LogsExplorer } from "@/components/logs-explorer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IMPORT_STATUSES } from "@/lib/domain/types";
import { STATUS_DESCRIPTIONS } from "@/lib/domain/log-statuses";
import { listLogs } from "@/lib/server/repository";

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
          <CardTitle>Status Guide</CardTitle>
          <CardDescription>Meaning of each template status shown in the operational logs.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {IMPORT_STATUSES.map((status) => (
            <div key={status} className="rounded-md border p-3">
              <div className="mb-2"><span className="font-semibold">{status}</span></div>
              <p className="text-sm text-muted-foreground">{STATUS_DESCRIPTIONS[status]}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operational Log Stream</CardTitle>
          <CardDescription>Designed for 100,000+ records with server-side pagination in production.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogsExplorer logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
