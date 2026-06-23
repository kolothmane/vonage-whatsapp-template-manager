import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/server/admin-access";
import { setEnvironmentWabaIds } from "@/lib/server/environments";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.wabaIds)) {
    return NextResponse.json({ error: "WABA IDs are required." }, { status: 400 });
  }
  try {
    const wabaIds = await setEnvironmentWabaIds((await context.params).id, body.wabaIds);
    return NextResponse.json({ success: true, wabaIds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update WABA IDs." },
      { status: 400 },
    );
  }
}
