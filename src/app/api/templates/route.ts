import { NextResponse, type NextRequest } from "next/server";
import { generateVonagePayload } from "@/lib/domain/payload";
import { validateImportRows } from "@/lib/domain/validation";
import { listTemplates, saveTemplate } from "@/lib/server/repository";
import { createVonageTemplate } from "@/lib/server/vonage";

export async function GET() {
  const templates = await listTemplates();
  return NextResponse.json({ data: templates });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    wabaId?: string;
    row?: Record<string, unknown>;
    submit?: boolean;
  };

  if (!body.wabaId || !body.row) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "wabaId and row are required." },
      { status: 400 },
    );
  }

  const existing = await listTemplates();
  const report = validateImportRows([body.row], existing, [body.wabaId]);
  if (!report.valid) {
    return NextResponse.json({ error: "VALIDATION_FAILED", report }, { status: 422 });
  }

  const payload = generateVonagePayload(report.templates[0]);

  if (!body.submit) {
    return NextResponse.json({ data: { payload, report }, message: "Validated without submission." });
  }

  try {
    const response = await createVonageTemplate(body.wabaId, payload);
    const template = await saveTemplate(body.wabaId, report.templates[0]);
    return NextResponse.json({ data: response, payload, template }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "VONAGE_SUBMISSION_FAILED",
        message: error instanceof Error ? error.message : "Template submission failed.",
        payload,
      },
      { status: 503 },
    );
  }
}
