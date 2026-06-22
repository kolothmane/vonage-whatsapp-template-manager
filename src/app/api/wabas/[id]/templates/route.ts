import { NextResponse, type NextRequest } from "next/server";
import { generateVonagePayload } from "@/lib/domain/payload";
import type { NormalizedTemplate, TemplateRecord } from "@/lib/domain/types";
import { listTemplates, saveWabaAssignments } from "@/lib/server/repository";
import { createVonageTemplate } from "@/lib/server/vonage";

function toNormalized(template: TemplateRecord): NormalizedTemplate {
  return {
    rowNumber: 1,
    brand: template.brand,
    language: template.language,
    whatsappLanguage: template.whatsappLanguage,
    originalName: template.originalName,
    generatedName: template.generatedName,
    body: template.body,
    normalizedBody: template.body,
    category: template.category,
    automation: template.automation,
    variableMappings: template.variableMappings,
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    for (const template of templates) {
      await createVonageTemplate(wabaId, generateVonagePayload(toNormalized(template)));
    }
    const assignments = await saveWabaAssignments(wabaId, templates);
    return NextResponse.json({ data: { submitted: assignments.length } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "WABA_SUBMISSION_FAILED", message: error instanceof Error ? error.message : "Unable to submit templates." },
      { status: 503 },
    );
  }
}
