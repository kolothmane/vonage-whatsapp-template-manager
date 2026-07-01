import { NextResponse } from "next/server";
import type { MassDeploymentItem, MassDeploymentRecord, SubmissionErrorRecord } from "@/lib/domain/types";
import { environmentKey } from "@/lib/server/environments";
import { getKv } from "@/lib/server/kv";

async function readCollection<T>(key: string): Promise<T[]> {
  return (await getKv().get<T[]>(key)) ?? [];
}

function summarizeMessages(errors: SubmissionErrorRecord[]) {
  const grouped = new Map<string, { count: number; code?: string; message: string; samples: SubmissionErrorRecord[] }>();
  for (const error of errors) {
    const key = `${error.errorCode ?? "UNKNOWN"}:${error.errorMessage}`;
    const existing = grouped.get(key) ?? {
      count: 0,
      code: error.errorCode,
      message: error.errorMessage,
      samples: [],
    };
    existing.count += 1;
    if (existing.samples.length < 5) existing.samples.push(error);
    grouped.set(key, existing);
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const environmentId = url.searchParams.get("environmentId") ?? "";
  const deploymentId = url.searchParams.get("deploymentId") ?? "";
  if (!environmentId || !deploymentId) {
    return NextResponse.json(
      { error: "MISSING_QUERY", message: "environmentId and deploymentId are required." },
      { status: 400 },
    );
  }

  const keys = {
    deployments: environmentKey(environmentId, "mass-deployments"),
    items: environmentKey(environmentId, "mass-deployment-items"),
    errors: environmentKey(environmentId, "submission-errors"),
  };
  const [deployments, items, errors] = await Promise.all([
    readCollection<MassDeploymentRecord>(keys.deployments),
    readCollection<MassDeploymentItem>(keys.items),
    readCollection<SubmissionErrorRecord>(keys.errors),
  ]);

  const deployment = deployments.find((item) => item.id === deploymentId);
  const relatedItems = items.filter((item) => item.deploymentId === deploymentId);
  const relatedErrors = errors.filter((item) => item.deploymentId === deploymentId);
  const byStatus = relatedItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
  const byWaba = relatedErrors.reduce<Record<string, number>>((acc, error) => {
    const key = `${error.wabaId} ${error.wabaName}`.trim();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const byTemplate = relatedErrors.reduce<Record<string, number>>((acc, error) => {
    acc[error.templateName] = (acc[error.templateName] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    deployment,
    itemStatusCounts: byStatus,
    totalItems: relatedItems.length,
    totalErrors: relatedErrors.length,
    submittedSamples: relatedItems
      .filter((item) => item.status === "Submitted")
      .slice(0, 10)
      .map((item) => ({
        wabaId: item.wabaId,
        wabaName: item.wabaName,
        templateName: item.templateName,
        brand: item.brand,
        language: item.language,
        submittedAt: item.submittedAt,
      })),
    errorMessageSummary: summarizeMessages(relatedErrors),
    topFailingWabas: Object.entries(byWaba)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([waba, count]) => ({ waba, count })),
    topFailingTemplates: Object.entries(byTemplate)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([template, count]) => ({ template, count })),
  });
}
