import { Queue, type ConnectionOptions } from "bullmq";
import { generateVonagePayload } from "@/lib/domain/payload";
import type { NormalizedTemplate } from "@/lib/domain/types";

let importQueue: Queue | null = null;

function getRedisConnectionOptions(): ConnectionOptions {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required for queue processing.");
  }

  const url = new URL(process.env.REDIS_URL);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.slice(1) || 0) : 0,
    maxRetriesPerRequest: null,
  };
}

export function getImportQueue() {
  if (!importQueue) {
    importQueue = new Queue("template-imports", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 10000,
      },
    });
  }

  return importQueue;
}

export async function queueTemplateImport(params: {
  importId: string;
  wabaIds: string[];
  templates: NormalizedTemplate[];
  batchSize: number;
}) {
  const queue = getImportQueue();
  const jobs = params.templates.flatMap((template) =>
    params.wabaIds.map((wabaId) => ({
      name: "create-template",
      data: {
        importId: params.importId,
        wabaId,
        generatedName: template.generatedName,
        payload: generateVonagePayload(template),
      },
    })),
  );

  return queue.addBulk(jobs);
}
