import { NextResponse } from "next/server";
import { updateVonageTemplate } from "@/lib/server/vonage";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; templateId: string }> },
) {
  const { id, templateId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.language || !body?.category || !body?.body || !Array.isArray(body.components)) {
    return NextResponse.json({ message: "Name, language, category and body are required." }, { status: 400 });
  }
  try {
    await updateVonageTemplate(id, templateId, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update template." },
      { status: 503 },
    );
  }
}
