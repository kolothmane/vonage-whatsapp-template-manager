import { NextResponse } from "next/server";
import { runMassDeploymentBatch } from "@/lib/server/mass-deployment-runner";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const environmentId = url.searchParams.get("environmentId") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 100);
  if (!environmentId) {
    return NextResponse.json({ error: "ENVIRONMENT_REQUIRED", message: "environmentId is required." }, { status: 400 });
  }

  try {
    const result = await runMassDeploymentBatch(environmentId, Number.isFinite(limit) ? limit : 100);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: "MASS_DEPLOYMENT_RUN_FAILED", message: error instanceof Error ? error.message : "Unable to run deployment batch." },
      { status: 503 },
    );
  }
}
