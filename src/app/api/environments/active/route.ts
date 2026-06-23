import { NextResponse } from "next/server";
import { setActiveEnvironment } from "@/lib/server/environments";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Environment ID is required." }, { status: 400 });
  try {
    await setActiveEnvironment(body.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Access denied." }, { status: 403 });
  }
}
