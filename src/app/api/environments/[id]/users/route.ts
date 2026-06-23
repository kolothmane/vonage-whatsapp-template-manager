import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAllowedCompanyDomain, isAdminEmail, normalizeEmail } from "@/lib/server/admin-access";
import { assignEnvironmentUsers } from "@/lib/server/environments";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.emails)) return NextResponse.json({ error: "Emails are required." }, { status: 400 });
  const emails = [...new Set<string>(
    body.emails
      .filter((email: unknown): email is string => typeof email === "string")
      .map(normalizeEmail)
      .filter(Boolean),
  )];
  if (emails.some((email) => !hasAllowedCompanyDomain(email))) {
    return NextResponse.json({ error: "Only company email domains are allowed." }, { status: 400 });
  }
  await assignEnvironmentUsers((await context.params).id, emails);
  return NextResponse.json({ success: true });
}
