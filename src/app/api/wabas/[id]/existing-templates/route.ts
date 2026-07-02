import { NextResponse } from "next/server";
import { listVonageTemplates } from "@/lib/server/vonage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const templates = await listVonageTemplates(id);
    return NextResponse.json({
      data: templates.map((template) => ({
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "VONAGE_TEMPLATE_LIST_FAILED",
        message: error instanceof Error ? error.message : "Unable to list existing WABA templates.",
      },
      { status: 503 },
    );
  }
}
