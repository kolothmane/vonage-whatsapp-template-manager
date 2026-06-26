import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { createMassDeploymentPlan, listTemplates } from "@/lib/server/repository";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id: wabaId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { templateIds?: string[] };
  if (!Array.isArray(body.templateIds) || !body.templateIds.length) {
    return NextResponse.json({ error: "TEMPLATES_REQUIRED", message: "Select at least one catalog template." }, { status: 400 });
  }

  const catalog = await listTemplates();
  const templates = catalog.filter((template) => !template.wabaId && body.templateIds!.includes(template.id));
  if (templates.length !== body.templateIds.length) {
    return NextResponse.json({ error: "TEMPLATE_NOT_FOUND", message: "One or more selected catalog templates no longer exist." }, { status: 404 });
  }

  try {
    const result = await createMassDeploymentPlan({
      name: `Deployment for WABA ${wabaId}`,
      wabaTemplateIds: { [wabaId]: body.templateIds },
      batchSize: 100,
      actor: { name: session?.user?.name, email: session?.user?.email },
    });
    return NextResponse.json({ data: { deployment: result.deployment, planned: result.items.length } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "WABA_DEPLOYMENT_PLAN_FAILED", message: error instanceof Error ? error.message : "Unable to create deployment plan." },
      { status: 503 },
    );
  }
}
