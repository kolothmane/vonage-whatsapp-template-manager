import { KeyRound, LockKeyhole, ServerCog } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { maskSecret } from "@/lib/server/auth";

const environmentRows = [
  ["VONAGE_API_KEY", maskSecret(process.env.VONAGE_API_KEY)],
  ["VONAGE_API_SECRET", maskSecret(process.env.VONAGE_API_SECRET)],
  ["VONAGE_APPLICATION_ID", maskSecret(process.env.VONAGE_APPLICATION_ID)],
  ["VONAGE_PRIVATE_KEY", process.env.VONAGE_PRIVATE_KEY ? "configured" : "not configured"],
  ["DATABASE_URL", process.env.DATABASE_URL ? "configured" : "not configured"],
  ["REDIS_URL", process.env.REDIS_URL ? "configured" : "not configured"],
  ["KV_REST_API_URL", process.env.KV_REST_API_URL ? "configured" : "not configured"],
  ["KV_REST_API_TOKEN", process.env.KV_REST_API_TOKEN ? "configured" : "not configured"],
  ["JWT_SECRET", process.env.JWT_SECRET ? "configured" : "not configured"],
];

export default function SettingsPage() {
  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Security, queue and import controls for production operations.</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4" />
              Security
            </CardTitle>
            <CardDescription>JWT authentication, password hashing and RBAC are configured in the server layer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Admin</span>
              <StatusBadge status="Full access" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Operator</span>
              <StatusBadge status="Can import" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Viewer</span>
              <StatusBadge status="Read only" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-4 w-4" />
              Queue Controls
            </CardTitle>
            <CardDescription>BullMQ controls for large batches and retries.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Batch Size
              <Input
                defaultValue={process.env.IMPORT_BATCH_SIZE ?? ""}
                placeholder="Not configured"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Concurrency
              <Input
                defaultValue={process.env.IMPORT_CONCURRENCY ?? ""}
                placeholder="Not configured"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Rate Limit per Minute
              <Input
                defaultValue={process.env.IMPORT_RATE_LIMIT_PER_MINUTE ?? ""}
                placeholder="Not configured"
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Environment
            </CardTitle>
            <CardDescription>Secrets are never exposed; visible values are masked or summarized.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {environmentRows.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span className="font-mono text-xs text-muted-foreground">{key}</span>
                <span className="text-xs">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
