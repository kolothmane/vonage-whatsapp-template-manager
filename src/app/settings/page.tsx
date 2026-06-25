import { KeyRound, Stethoscope, UsersRound } from "lucide-react";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WhitelistManager } from "@/components/whitelist-manager";
import { VonageConnectionAuditPanel } from "@/components/vonage-connection-audit";
import { EnvironmentManager } from "@/components/environment-manager";
import { isAdminEmail } from "@/lib/server/admin-access";
import { maskSecret } from "@/lib/server/auth";
import { listWhitelistedEmails, type WhitelistEntry } from "@/lib/server/whitelist";
import { listEnvironmentsForUser, type SafeEnvironment } from "@/lib/server/environments";

const environmentRows = [
  ["AUTH_SECRET", process.env.AUTH_SECRET ? "configured" : "not configured"],
  ["AUTH_GOOGLE_ID", process.env.AUTH_GOOGLE_ID ? "configured" : "not configured"],
  ["AUTH_GOOGLE_SECRET", maskSecret(process.env.AUTH_GOOGLE_SECRET)],
  ["ADMIN_EMAILS", process.env.ADMIN_EMAILS ? "configured" : "not configured"],
  ["CREDENTIALS_ENCRYPTION_KEY", process.env.CREDENTIALS_ENCRYPTION_KEY ? "configured" : "not configured"],
  ["VONAGE_VCR_CREDENTIAL_NAME", process.env.VONAGE_VCR_CREDENTIAL_NAME ? "configured" : "not configured"],
  ["KV_REST_API_URL", process.env.KV_REST_API_URL ? "configured" : "not configured"],
  ["KV_REST_API_TOKEN", process.env.KV_REST_API_TOKEN ? "configured" : "not configured"],
];

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = isAdminEmail(session?.user?.email);
  let whitelist: WhitelistEntry[] = [];
  let whitelistError = "";
  let environments: SafeEnvironment[] = [];

  if (isAdmin) {
    try {
      whitelist = await listWhitelistedEmails();
      environments = await listEnvironmentsForUser(session!.user!.email!);
    } catch (error) {
      whitelistError = error instanceof Error ? error.message : "Unable to load whitelist.";
    }
  }

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

      {isAdmin ? (
        <section className="max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Vonage environments</CardTitle>
              <CardDescription>Create encrypted environments and assign access to users.</CardDescription>
            </CardHeader>
            <CardContent>
              <EnvironmentManager
                initialEnvironments={environments}
                userEmails={[...new Set([session!.user!.email!, ...whitelist.map((entry) => entry.email)])]}
              />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Vonage connection audit
              </CardTitle>
              <CardDescription>
                Compare account credentials, application ownership and Channel Manager visibility.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VonageConnectionAuditPanel />
            </CardContent>
          </Card>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                User whitelist
              </CardTitle>
              <CardDescription>
                Users listed here may sign in with a verified company Google account. The list is stored in Upstash KV; admins are controlled separately by ADMIN_EMAILS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {whitelistError ? (
                <p role="alert" className="text-sm text-destructive">{whitelistError}</p>
              ) : (
                <WhitelistManager initialEntries={whitelist} environments={environments} />
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
