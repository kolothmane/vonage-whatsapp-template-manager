import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createMassDeploymentPlan, listMassDeployments } from "@/lib/server/repository";

export async function GET() {
  return NextResponse.json({ data: await listMassDeployments() });
}

export async function POST(request: Request) {
  const session = await auth();
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    batchSize?: number;
    wabaTemplateIds?: Record<string, string[]>;
  };
  if (!body.wabaTemplateIds || !Object.keys(body.wabaTemplateIds).length) {
    return NextResponse.json(
      { error: "ASSIGNMENTS_REQUIRED", message: "Select templates for at least one WABA." },
      { status: 400 },
    );
  }

  try {
    const result = await createMassDeploymentPlan({
      name: body.name ?? "",
      batchSize: body.batchSize,
      wabaTemplateIds: body.wabaTemplateIds,
      actor: { name: session?.user?.name, email: session?.user?.email },
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "MASS_DEPLOYMENT_CREATE_FAILED", message: error instanceof Error ? error.message : "Unable to create deployment." },
      { status: 503 },
    );
  }
}
