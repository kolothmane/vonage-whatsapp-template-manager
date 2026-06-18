import { NextResponse } from "next/server";
import { getImportById } from "@/lib/server/repository";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const record = await getImportById(id);

  if (!record) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Import not found." }, { status: 404 });
  }

  return NextResponse.json({ data: record });
}
