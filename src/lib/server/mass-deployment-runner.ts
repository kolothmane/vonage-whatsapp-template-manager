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
  return /already exists|duplicate|conflict|name.*taken|template.*exist|content.*language.*exists|language.*already exists/i.test(message)
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
  const activeDeployment = running;

  const templateById = new Map(templates.map((template) => [template.id, template]));
  const queue = items
    .filter((item) => item.deploymentId === activeDeployment.id && item.status === "Queued")
    .slice(0, Math.min(limit, activeDeployment.batchSize));
  let currentItems = items;
  let currentDeployments = deployments;
  let currentErrors = existingErrors;
  let submitted = 0;
  let failed = 0;

  console.log("[mass-deployment:batch] started", {
    deploymentId: activeDeployment.id,
    environmentId,
    requestedLimit,
    queue: queue.length,
  });

  async function persistItem(update: MassDeploymentItem, error?: SubmissionErrorRecord) {
    currentItems = currentItems.map((item) => (item.id === update.id ? update : item));
    if (error) {
      currentErrors = [error, ...currentErrors];
    }
    currentDeployments = currentDeployments.map((deployment) =>
      deployment.id === activeDeployment.id ? summarizeDeployment(deployment, currentItems) : deployment,
    );

    await Promise.all([
      getKv().set(keys.items, currentItems),
      getKv().set(keys.deployments, currentDeployments),
      error ? getKv().set(keys.errors, currentErrors) : Promise.resolve(),
    ]);
  }

  for (const item of queue) {
    const latestDeployments = await readCollection<MassDeploymentRecord>(keys.deployments);
    const latestDeployment = latestDeployments.find((deployment) => deployment.id === activeDeployment.id);
    if (!latestDeployment || latestDeployment.status !== "Running") {
      console.log("[mass-deployment:batch] stopped", {
        deploymentId: activeDeployment.id,
        status: latestDeployment?.status ?? "missing",
        submitted,
        failed,
      });
      break;
    }
    currentDeployments = latestDeployments;

    const now = new Date().toISOString();
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
      const submissionError = {
        id: crypto.randomUUID(),
        deploymentId: activeDeployment.id,
        deploymentName: activeDeployment.name,
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
      };
      await persistItem(update, submissionError);
      continue;
    }

    try {
      const response = await createVonageTemplateForConfig(
        config,
        item.wabaId,
        generateVonagePayload(toNormalized(source)),
      );
      submitted += 1;
      const update = {
        ...item,
        status: "Submitted" as const,
        attempts: item.attempts + 1,
        lastAttemptAt: now,
        submittedAt: now,
        vonageTemplateId: typeof response?.id === "string" ? response.id : undefined,
        errorCode: undefined,
        errorMessage: undefined,
      };
      await persistItem(update);
      console.log("[mass-deployment:batch] submitted", {
        deploymentId: activeDeployment.id,
        itemId: item.id,
        wabaId: item.wabaId,
        templateName: item.templateName,
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
      const submissionError = {
        id: crypto.randomUUID(),
        deploymentId: activeDeployment.id,
        deploymentName: activeDeployment.name,
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
      };
      await persistItem(update, submissionError);
      console.log("[mass-deployment:batch] failed", {
        deploymentId: activeDeployment.id,
        itemId: item.id,
        wabaId: item.wabaId,
        templateName: item.templateName,
        errorCode: code,
        errorMessage: message,
      });
    }
  }

  return {
    deploymentId: activeDeployment.id,
    processed: queue.length,
    submitted,
    failed,
    remaining: currentItems.filter((item) => item.deploymentId === activeDeployment.id && item.status === "Queued").length,
  };
}
