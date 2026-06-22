import { NextResponse, type NextRequest } from "next/server";
import { deleteTemplates } from "@/lib/server/repository";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(body.ids) || !body.ids.length) {
    return NextResponse.json({ error: "IDS_REQUIRED", message: "Select at least one template." }, { status: 400 });
  }

  try {
    const deleted = await deleteTemplates([...new Set(body.ids)]);
    return NextResponse.json({ data: { deleted } });
  } catch (error) {
    return NextResponse.json(
      { error: "DELETE_FAILED", message: error instanceof Error ? error.message : "Unable to delete templates." },
      { status: 503 },
    );
  }
}
