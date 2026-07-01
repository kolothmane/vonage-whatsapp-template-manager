import { NextResponse } from "next/server";
import { listWabas, saveWabas } from "@/lib/server/repository";
import { fetchVonageWabas } from "@/lib/server/vonage";

export async function GET() {
  const wabas = await listWabas();
  return NextResponse.json({ data: wabas });
}

export async function POST() {
  try {
    const data = await fetchVonageWabas();
    await saveWabas(data);
    const visibleWabas = await listWabas();
    return NextResponse.json({ data: visibleWabas, message: "WABAs retrieved from Vonage." });
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
