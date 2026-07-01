import { ApiLogLimitSelect } from "@/components/api-log-limit-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listApiLogs } from "@/lib/server/repository";

const LIMITS = [5, 10, 25, 100];

type ApiLogsPageProps = {
  searchParams: Promise<{ limit?: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function selectedLimit(value: string | undefined) {
  const parsed = Number(value);
  return LIMITS.includes(parsed) ? parsed : 25;
}

export default async function ApiLogsPage({ searchParams }: ApiLogsPageProps) {
  const params = await searchParams;
  const limit = selectedLimit(params.limit);
  const logs = await listApiLogs(limit);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Logs API</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent server-side calls sent to Vonage. Sensitive headers and tokens are never stored.
          </p>
        </div>
        <ApiLogLimitSelect value={limit} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Call Stream</CardTitle>
          <CardDescription>Showing the latest {limit} recorded API calls for the active environment.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Time</th>
                  <th className="py-2 pr-3 font-medium">Method</th>
                  <th className="py-2 pr-3 font-medium">Endpoint</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Duration</th>
                  <th className="py-2 pr-3 font-medium">Environment</th>
                  <th className="py-2 pr-3 font-medium">WABA</th>
                  <th className="py-2 pr-3 font-medium">Auth</th>
                  <th className="py-2 pr-3 font-medium">Response</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap py-3 pr-3 text-muted-foreground">{formatDate(log.timestamp)}</td>
                    <td className="py-3 pr-3 font-medium">{log.method}</td>
                    <td className="max-w-[300px] py-3 pr-3">
                      <div className="truncate font-mono text-xs" title={`${log.url}${log.endpoint}`}>
                        {log.endpoint}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <Badge variant={log.ok ? "secondary" : "danger"}>
                        {log.status ?? "ERR"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3">{log.durationMs} ms</td>
                    <td className="py-3 pr-3">{log.environmentName ?? log.environmentId ?? "Unknown"}</td>
                    <td className="whitespace-nowrap py-3 pr-3">{log.wabaId ?? "-"}</td>
                    <td className="whitespace-nowrap py-3 pr-3">
                      {log.credentialSource ?? "-"}
                      {log.apiKeySuffix ? <span className="text-muted-foreground"> · *{log.apiKeySuffix}</span> : null}
                    </td>
                    <td className="max-w-[320px] py-3 pr-3">
                      <div className="line-clamp-2 text-muted-foreground" title={log.errorMessage ?? log.responseSummary ?? ""}>
                        {log.errorMessage ?? log.responseSummary ?? "-"}
                      </div>
                      {log.requestId ? <div className="mt-1 font-mono text-[11px] text-muted-foreground">{log.requestId}</div> : null}
                    </td>
                  </tr>
                ))}
                {!logs.length ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-muted-foreground">
                      No API calls have been recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
