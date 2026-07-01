import { NextResponse } from "next/server";
import { after } from "next/server";
import { getActiveEnvironment } from "@/lib/server/environments";
import { runMassDeploymentBatch } from "@/lib/server/mass-deployment-runner";
import { startMassDeployment } from "@/lib/server/repository";

export const maxDuration = 300;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const environment = await getActiveEnvironment();
  const deployment = await startMassDeployment(id);
  if (!deployment) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Deployment was not found." }, { status: 404 });
  }

  after(async () => {
    try {
      await runMassDeploymentBatch(environment.id, deployment.batchSize, deployment.id);
    } catch (error) {
      console.error("[mass-deployment:start:first-run] failed", {
        deploymentId: deployment.id,
        environmentId: environment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return NextResponse.json({
    data: deployment,
    firstRun: {
      status: "scheduled",
      message: "First batch was launched immediately. The scheduler will process the next batches.",
    },
  });
}
