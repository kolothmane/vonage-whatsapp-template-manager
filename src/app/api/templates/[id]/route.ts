import { NextResponse } from "next/server";
import { hasDatabaseUrl, getPrisma } from "@/lib/server/db";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      {
        error: "DATABASE_REQUIRED",
        message: "Template deletion requires DATABASE_URL and a migrated PostgreSQL database.",
      },
      { status: 503 },
    );
  }

  await getPrisma().template.delete({ where: { id } });
  return NextResponse.json({ data: { id }, message: "Template deleted." });
}
