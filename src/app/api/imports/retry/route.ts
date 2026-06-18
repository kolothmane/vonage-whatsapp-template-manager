import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { importId?: string; scope?: "single" | "batch" | "all_failed" };

  if (!body.importId || !body.scope) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "importId and scope are required." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    data: {
      importId: body.importId,
      scope: body.scope,
      status: "Queued",
    },
    message: "Retry request accepted. Configure REDIS_URL to process jobs with BullMQ.",
  });
}
