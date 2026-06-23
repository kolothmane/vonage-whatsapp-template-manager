import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/server/admin-access";
import { createEnvironment, listEnvironmentsForUser } from "@/lib/server/environments";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ environments: await listEnvironmentsForUser(session.user.email) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.apiKey || !body?.apiSecret || !body?.applicationId || !body?.privateKey) {
    return NextResponse.json({ error: "All Vonage credentials are required." }, { status: 400 });
  }
  const id = await createEnvironment({ ...body, createdBy: session.user.email });
  return NextResponse.json({ id }, { status: 201 });
}
