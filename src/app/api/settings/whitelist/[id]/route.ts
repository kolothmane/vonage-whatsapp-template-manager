import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/server/admin-access";
import { removeWhitelistedEmail } from "@/lib/server/whitelist";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    await removeWhitelistedEmail(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove email." },
      { status: 503 },
    );
  }
}
