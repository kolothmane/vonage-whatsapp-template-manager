import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/server/admin-access";
import { updateEnvironmentCredentials } from "@/lib/server/environments";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.apiKey || !body?.apiSecret) {
    return NextResponse.json({ error: "API key and API secret are required." }, { status: 400 });
  }

  const privateKey = String(body.privateKeyFile ?? "").replace(/\\n/g, "\n").trim();
  if (privateKey && (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----"))) {
    return NextResponse.json({ error: "Select a valid Vonage .key or .pem private key file." }, { status: 400 });
  }

  await updateEnvironmentCredentials((await context.params).id, {
    apiKey: body.apiKey,
    apiSecret: body.apiSecret,
    applicationId: body.applicationId,
    privateKey,
  });

  return NextResponse.json({ success: true });
}
