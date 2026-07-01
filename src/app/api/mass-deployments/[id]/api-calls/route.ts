import { NextResponse } from "next/server";
import { listApiLogs, listMassDeploymentItems, listMassDeployments } from "@/lib/server/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [deployments, items, apiLogs] = await Promise.all([
    listMassDeployments(),
    listMassDeploymentItems(id),
    listApiLogs(100),
  ]);
  const deployment = deployments.find((item) => item.id === id);
  if (!deployment) {
    return NextResponse.json(
      { error: "DEPLOYMENT_NOT_FOUND", message: "Deployment not found." },
      { status: 404 },
    );
  }

  const wabaIds = new Set(items.map((item) => item.wabaId));
  const since = Date.parse(deployment.startedAt ?? deployment.createdAt);
  const logs = apiLogs
    .filter((log) => {
      const timestamp = Date.parse(log.timestamp);
      const isAfterDeploymentStarted = Number.isFinite(timestamp) && timestamp >= since;
      const isDeploymentWabaCall = log.wabaId ? wabaIds.has(log.wabaId) : false;
      const isTokenCall = log.endpoint.includes("/v1/creds/");
      return isAfterDeploymentStarted && (isDeploymentWabaCall || isTokenCall);
    })
    .slice(0, 50);

  return NextResponse.json({
    data: {
      deployment,
      logs,
      refreshedAt: new Date().toISOString(),
    },
  });
}
