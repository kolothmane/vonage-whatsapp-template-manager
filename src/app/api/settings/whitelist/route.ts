import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/server/admin-access";
import { addWhitelistedEmail, listWhitelistedEmails } from "@/lib/server/whitelist";

const createSchema = z.object({
  email: z.string().trim().email(),
});

async function requireAdmin() {
  const session = await auth();
  const email = session?.user?.email;
  return email && isAdminEmail(email) ? email : null;
}

export async function GET() {
  const adminEmail = await requireAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    return NextResponse.json({ entries: await listWhitelistedEmails() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load whitelist." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const adminEmail = await requireAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  try {
    const entry = await addWhitelistedEmail(parsed.data.email, adminEmail);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add email.";
    const status = message.includes("already whitelisted")
      ? 409
      : message.includes("must belong")
        ? 400
        : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
