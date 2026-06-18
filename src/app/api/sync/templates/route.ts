import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { wabaIds?: string[] };
  const wabaIds = body.wabaIds ?? [];

  return NextResponse.json({
    data: {
      wabaIds,
      status: "Queued",
    },
    message: "Template sync queued. Configure workers with REDIS_URL for production processing.",
  });
}
