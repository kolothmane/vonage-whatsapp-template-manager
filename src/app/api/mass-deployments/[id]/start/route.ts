import { NextResponse } from "next/server";
import { startMassDeployment } from "@/lib/server/repository";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deployment = await startMassDeployment(id);
  if (!deployment) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Deployment was not found." }, { status: 404 });
  }
  return NextResponse.json({ data: deployment });
}
