import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { maskSecret } from "@/lib/server/auth";

const environmentRows = [
  ["VONAGE_API_KEY", maskSecret(process.env.VONAGE_API_KEY)],
  ["VONAGE_API_SECRET", maskSecret(process.env.VONAGE_API_SECRET)],
  ["KV_REST_API_URL", process.env.KV_REST_API_URL ? "configured" : "not configured"],
  ["KV_REST_API_TOKEN", process.env.KV_REST_API_TOKEN ? "configured" : "not configured"],
];

export default function SettingsPage() {
  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Required production integrations.</p>
      </section>

      <section className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Environment
            </CardTitle>
            <CardDescription>Only variables required by the current application flow are listed.</CardDescription>
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
