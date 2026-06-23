import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/server/admin-access";
import { auditVonageConnection } from "@/lib/server/vonage";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    return NextResponse.json({ audit: await auditVonageConnection() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to audit Vonage connection.",
      },
      { status: 503 },
    );
  }
}
