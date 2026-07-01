import { generateVonagePayload } from "@/lib/domain/payload";
import type {
  MassDeploymentItem,
  MassDeploymentRecord,
  NormalizedTemplate,
  SubmissionErrorRecord,
  TemplateRecord,
} from "@/lib/domain/types";
import { environmentKey, getEnvironmentConfigById } from "@/lib/server/environments";
import { getKv } from "@/lib/server/kv";
import { createVonageTemplateForConfig } from "@/lib/server/vonage";

async function readCollection<T>(key: string): Promise<T[]> {
  return (await getKv().get<T[]>(key)) ?? [];
}

function toNormalized(template: TemplateRecord): NormalizedTemplate {
  return {
    rowNumber: 1,
    brand: template.brand,
    language: template.language,
    whatsappLanguage: template.whatsappLanguage,
    originalName: template.originalName,
    generatedName: template.generatedName,
    body: template.body,
    normalizedBody: template.body,
    category: template.category,
    automation: template.automation,
    variableMappings: template.variableMappings,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown submission error.";
}

function submissionErrorCode(message: string) {
  return /already exists|duplicate|conflict|name.*taken|template.*exist/i.test(message)
    ? "DUPLICATE_TEMPLATE"
    : "VONAGE_SUBMISSION_FAILED";
}

function summarizeDeployment(deployment: MassDeploymentRecord, items: MassDeploymentItem[]) {
  const related = items.filter((item) => item.deploymentId === deployment.id);
  const queued = related.filter((item) => item.status === "Queued").length;
  const submitted = related.filter((item) => item.status === "Submitted").length;
  const failed = related.filter((item) => item.status === "Failed").length;
  const skipped = related.filter((item) => item.status === "Skipped").length;
  return {
    ...deployment,
    total: related.length,
    queued,
    submitted,
    failed,
    skipped,
    status: queued === 0 ? failed > 0 ? "Failed" as const : "Completed" as const : deployment.status,
    completedAt: queued === 0 ? deployment.completedAt ?? new Date().toISOString() : deployment.completedAt,
    updatedAt: new Date().toISOString(),
    lastRunAt: new Date().toISOString(),
  };
}

export async function runMassDeploymentBatch(environmentId: string, requestedLimit = 100, deploymentId?: string) {
  const limit = Math.max(1, Math.min(100, requestedLimit));
  const config = await getEnvironmentConfigById(environmentId);
  const keys = {
    deployments: environmentKey(environmentId, "mass-deployments"),
    items: environmentKey(environmentId, "mass-deployment-items"),
    templates: environmentKey(environmentId, "templates"),
    errors: environmentKey(environmentId, "submission-errors"),
  };
  const [deployments, items, templates, existingErrors] = await Promise.all([
    readCollection<MassDeploymentRecord>(keys.deployments),
    readCollection<MassDeploymentItem>(keys.items),
    readCollection<TemplateRecord>(keys.templates),
    readCollection<SubmissionErrorRecord>(keys.errors),
  ]);
  const running = deployments.find((deployment) =>
    deployment.status === "Running" && (!deploymentId || deployment.id === deploymentId),
  );
  if (!running) {
    return { processed: 0, submitted: 0, failed: 0, message: deploymentId ? "Deployment is not running." : "No running deployment." };
  }

  const templateById = new Map(templates.map((template) => [template.id, template]));
  const queue = items
    .filter((item) => item.deploymentId === running.id && item.status === "Queued")
    .slice(0, Math.min(limit, running.batchSize));
  const now = new Date().toISOString();
  const updatedItems = new Map<string, MassDeploymentItem>();
  const newErrors: SubmissionErrorRecord[] = [];
  let submitted = 0;
  let failed = 0;

  for (const item of queue) {
    const source = templateById.get(item.sourceTemplateId);
    if (!source) {
      failed += 1;
      const message = "Source catalog template was not found.";
      const update = {
        ...item,
        status: "Failed" as const,
        attempts: item.attempts + 1,
        lastAttemptAt: now,
        errorCode: "SOURCE_TEMPLATE_NOT_FOUND",
        errorMessage: message,
      };
      updatedItems.set(item.id, update);
      newErrors.push({
        id: crypto.randomUUID(),
        deploymentId: running.id,
        deploymentName: running.name,
        itemId: item.id,
        wabaId: item.wabaId,
        wabaName: item.wabaName,
        templateId: item.sourceTemplateId,
        templateName: item.templateName,
        brand: item.brand,
        language: item.language,
        errorMessage: message,
        errorCode: "SOURCE_TEMPLATE_NOT_FOUND",
        attempt: update.attempts,
        timestamp: now,
      });
      continue;
    }

    try {
      const response = await createVonageTemplateForConfig(
        config,
        item.wabaId,
        generateVonagePayload(toNormalized(source)),
      );
      submitted += 1;
      updatedItems.set(item.id, {
        ...item,
        status: "Submitted",
        attempts: item.attempts + 1,
        lastAttemptAt: now,
        submittedAt: now,
        vonageTemplateId: typeof response?.id === "string" ? response.id : undefined,
        errorCode: undefined,
        errorMessage: undefined,
      });
    } catch (error) {
      failed += 1;
      const message = errorMessage(error);
      const code = submissionErrorCode(message);
      const update = {
        ...item,
        status: "Failed" as const,
        attempts: item.attempts + 1,
        lastAttemptAt: now,
        errorCode: code,
        errorMessage: message,
      };
      updatedItems.set(item.id, update);
      newErrors.push({
        id: crypto.randomUUID(),
        deploymentId: running.id,
        deploymentName: running.name,
        itemId: item.id,
        wabaId: item.wabaId,
        wabaName: item.wabaName,
        templateId: item.sourceTemplateId,
        templateName: item.templateName,
        brand: item.brand,
        language: item.language,
        errorMessage: message,
        errorCode: code,
        attempt: update.attempts,
        timestamp: now,
      });
    }
  }

  const nextItems = items.map((item) => updatedItems.get(item.id) ?? item);
  const nextDeployments = deployments.map((deployment) =>
    deployment.id === running.id ? summarizeDeployment(deployment, nextItems) : deployment,
  );

  await Promise.all([
    getKv().set(keys.items, nextItems),
    getKv().set(keys.deployments, nextDeployments),
    getKv().set(keys.errors, [...newErrors, ...existingErrors]),
  ]);

  return {
    deploymentId: running.id,
    processed: queue.length,
    submitted,
    failed,
    remaining: nextItems.filter((item) => item.deploymentId === running.id && item.status === "Queued").length,
  };
}
