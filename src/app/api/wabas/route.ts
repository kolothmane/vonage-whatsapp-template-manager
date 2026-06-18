import { NextResponse } from "next/server";
import { listWabas } from "@/lib/server/repository";
import { fetchVonageWabas } from "@/lib/server/vonage";

export async function GET() {
  const wabas = await listWabas();
  return NextResponse.json({ data: wabas });
}

export async function POST() {
  try {
    const data = await fetchVonageWabas();
    return NextResponse.json({ data, message: "WABAs retrieved from Vonage." });
  } catch (error) {
    return NextResponse.json(
      {
        error: "WABA_SYNC_FAILED",
        message: error instanceof Error ? error.message : "Unable to sync WABAs.",
      },
      { status: 503 },
    );
  }
}
