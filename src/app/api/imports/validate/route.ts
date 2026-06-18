import { NextResponse, type NextRequest } from "next/server";
import { generateVonagePayload } from "@/lib/domain/payload";
import { validateImportRows } from "@/lib/domain/validation";
import { listTemplates } from "@/lib/server/repository";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    rows?: Record<string, unknown>[];
    targetWabaIds?: string[];
  };

  if (!Array.isArray(body.rows) || !Array.isArray(body.targetWabaIds) || body.targetWabaIds.length === 0) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "rows and targetWabaIds are required." },
      { status: 400 },
    );
  }

  const existingTemplates = await listTemplates();
  const report = validateImportRows(body.rows, existingTemplates, body.targetWabaIds);
  const payloads = report.templates.map(generateVonagePayload);

  return NextResponse.json({
    data: {
      report,
      payloads,
      blocked: !report.valid,
      mode: "STRICT",
    },
  });
}
