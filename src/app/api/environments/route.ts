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
  if (!body?.name || !body?.apiKey || !body?.apiSecret) {
    return NextResponse.json({ error: "Environment name, API key and API secret are required." }, { status: 400 });
  }
  const id = await createEnvironment({
    name: body.name,
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    vcrCredentialName: body.vcrCredentialName,
    createdBy: session.user.email,
  });
  return NextResponse.json({ id }, { status: 201 });
}
