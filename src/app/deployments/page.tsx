import { MassDeploymentPlanner } from "@/components/mass-deployment-planner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveEnvironmentIdForUser } from "@/lib/server/environments";
import { listMassDeployments, listTemplates, listWabas } from "@/lib/server/repository";
import { auth } from "@/auth";

export default async function DeploymentsPage() {
  const session = await auth();
  const [wabas, templates, deployments] = await Promise.all([
    listWabas(),
    listTemplates(),
    listMassDeployments(),
  ]);
  const activeEnvironmentId = session?.user?.email
    ? await getActiveEnvironmentIdForUser(session.user.email)
    : "";

  return (
    <div className="grid gap-5">
      <section>
        <h1 className="text-2xl font-semibold">Mass Deployments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure large template submissions first, then let the hourly scheduler process safe batches in the background.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Deployment Planner</CardTitle>
          <CardDescription>
            Preparing a draft never submits templates. Only running plans are processed by the cron endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MassDeploymentPlanner
            activeEnvironmentId={activeEnvironmentId}
            deployments={deployments}
            templates={templates}
            wabas={wabas}
          />
        </CardContent>
      </Card>
    </div>
  );
}
