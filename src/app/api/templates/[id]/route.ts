import { NextResponse } from "next/server";
import { deleteTemplate } from "@/lib/server/repository";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteTemplate(id);
    return NextResponse.json({ data: { id }, message: "Template deleted." });
  } catch (error) {
    return NextResponse.json(
      {
        error: "PERSISTENCE_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Template deletion failed.",
      },
      { status: 503 },
    );
  }
}
