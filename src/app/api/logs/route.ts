import { NextResponse } from "next/server";
import { listLogs } from "@/lib/server/repository";

export async function GET() {
  const logs = await listLogs();
  return NextResponse.json({ data: logs });
}
