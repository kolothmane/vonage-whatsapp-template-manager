import type {
  AuditLogRecord,
  ImportRecord,
  LogRecord,
  NormalizedTemplate,
  TemplateRecord,
  Waba,
} from "@/lib/domain/types";
import { getPrisma, hasDatabaseUrl } from "./db";
import { getKv, hasKvConfig } from "./kv";
import { environmentKey, getActiveEnvironment } from "./environments";

async function kvKeys() {
  const environment = await getActiveEnvironment();
  return {
    wabas: environmentKey(environment.id, "wabas"),
    templates: environmentKey(environment.id, "templates"),
    imports: environmentKey(environment.id, "imports"),
    logs: environmentKey(environment.id, "logs"),
    auditLogs: environmentKey(environment.id, "audit-logs"),
  };
}

async function kvKeysForRead() {
  try {
    return await kvKeys();
  } catch (error) {
    if (error instanceof Error && error.message === "No Vonage environment is assigned to this user.") {
      return null;
    }
    throw error;
  }
}

async function readKvCollection<T>(key: string): Promise<T[]> {
  if (!hasKvConfig()) {
    return [];
  }

  return (await getKv().get<T[]>(key)) ?? [];
}

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : value;
}

function prismaWabaStatus(status: string): Waba["status"] {
  return status === "ActionRequired" ? "Action Required" : (status as Waba["status"]);
}

export async function listWabas(): Promise<Waba[]> {
  if (!hasDatabaseUrl()) {
    const keys = await kvKeysForRead();
    if (!keys) return [];
    const wabas = await readKvCollection<Waba>(keys.wabas);
    return wabas.sort((a, b) => a.name.localeCompare(b.name));
  }

  const prisma = getPrisma();
  const wabas = await prisma.waba.findMany({ orderBy: { name: "asc" } });
  return wabas.map((waba) => ({
    id: waba.id,
    name: waba.name,
    status: prismaWabaStatus(waba.status),
    country: waba.country,
    templateCount: waba.templateCount,
    lastSyncAt: toIso(waba.lastSyncAt),
  }));
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  if (!hasDatabaseUrl()) {
    const keys = await kvKeysForRead();
    if (!keys) return [];
    const templates = await readKvCollection<TemplateRecord>(keys.templates);
    return templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const prisma = getPrisma();
  const templates = await prisma.template.findMany({
    include: { waba: true, variableMaps: true },
    orderBy: { updatedAt: "desc" },
  });

  return templates.map((template) => ({
    id: template.id,
    wabaId: template.wabaId,
    wabaName: template.waba.name,
    brand: template.brand,
    language: template.language,
    whatsappLanguage: template.whatsappLang as TemplateRecord["whatsappLanguage"],
    originalName: template.originalName,
    generatedName: template.generatedName,
    body: template.body,
    category: template.category,
    automation: template.automation,
    status: template.status,
    variableMappings: template.variableMaps.map((mapping) => ({
      placeholder: mapping.placeholder as `{{${number}}}`,
      key: mapping.key,
      source: mapping.source,
    })),
    createdAt: toIso(template.createdAt),
    updatedAt: toIso(template.updatedAt),
  }));
}

export async function listImports(): Promise<ImportRecord[]> {
  if (!hasDatabaseUrl()) {
    const keys = await kvKeysForRead();
    if (!keys) return [];
    const imports = await readKvCollection<ImportRecord>(keys.imports);
    return imports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const prisma = getPrisma();
  const imports = await prisma.import.findMany({ orderBy: { createdAt: "desc" } });
  return imports.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    target: item.target,
    mode: item.mode,
    status: item.status,
    total: item.total,
    submitted: item.submitted,
    failed: item.failed,
    skipped: item.skipped,
    duplicates: item.duplicates,
    createdAt: toIso(item.createdAt),
  }));
}

export async function getImportById(id: string) {
  const imports = await listImports();
  return imports.find((item) => item.id === id) ?? null;
}

export async function listLogs(): Promise<LogRecord[]> {
  if (!hasDatabaseUrl()) {
    const keys = await kvKeysForRead();
    if (!keys) return [];
    const logs = await readKvCollection<LogRecord>(keys.logs);
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 500);
  }

  const prisma = getPrisma();
  const logs = await prisma.log.findMany({
    include: { waba: true },
    orderBy: { timestamp: "desc" },
    take: 500,
  });

  return logs.map((log) => ({
    id: log.id,
    importId: log.importId ?? "",
    wabaId: log.wabaId ?? "",
    wabaName: log.waba?.name ?? "Unknown WABA",
    templateName: log.templateName,
    brand: log.brand,
    language: log.language,
    status: log.status,
    message: log.message,
    timestamp: toIso(log.timestamp),
  }));
}

export async function listAuditLogs(): Promise<AuditLogRecord[]> {
  if (!hasDatabaseUrl()) {
    const keys = await kvKeysForRead();
    if (!keys) return [];
    const logs = await readKvCollection<AuditLogRecord>(keys.auditLogs);
    return logs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 500);
  }

  const prisma = getPrisma();
  const auditLogs = await prisma.auditLog.findMany({ orderBy: { date: "desc" }, take: 500 });
  return auditLogs.map((entry) => ({
    id: entry.id,
    user: entry.userEmail,
    action: entry.action,
    entity: entry.entity,
    oldValue: entry.oldValue ?? undefined,
    newValue: entry.newValue ?? undefined,
    date: toIso(entry.date),
  }));
}

export async function saveWabas(wabas: Waba[]) {
  if (hasDatabaseUrl()) {
    const prisma = getPrisma();
    await Promise.all(
      wabas.map((waba) =>
        prisma.waba.upsert({
          where: { id: waba.id },
          create: {
            id: waba.id,
            name: waba.name,
            status: waba.status === "Action Required" ? "ActionRequired" : waba.status,
            country: waba.country,
            templateCount: waba.templateCount,
            lastSyncAt: new Date(waba.lastSyncAt),
          },
          update: {
            name: waba.name,
            status: waba.status === "Action Required" ? "ActionRequired" : waba.status,
            country: waba.country,
            templateCount: waba.templateCount,
            lastSyncAt: new Date(waba.lastSyncAt),
          },
        }),
      ),
    );
    return;
  }

  if (hasKvConfig()) {
    await getKv().set((await kvKeys()).wabas, wabas);
  }
}

export async function saveTemplate(wabaId: string, template: NormalizedTemplate) {
  const now = new Date().toISOString();
  const waba = (await listWabas()).find((item) => item.id === wabaId);
  const record: TemplateRecord = {
    id: crypto.randomUUID(),
    wabaId,
    wabaName: waba?.name ?? wabaId,
    brand: template.brand,
    language: template.language,
    whatsappLanguage: template.whatsappLanguage,
    originalName: template.originalName,
    generatedName: template.generatedName,
    body: template.normalizedBody,
    category: template.category,
    automation: template.automation,
    status: "Submitted",
    variableMappings: template.variableMappings,
    createdAt: now,
    updatedAt: now,
  };

  if (hasKvConfig() && !hasDatabaseUrl()) {
    const key = (await kvKeys()).templates;
    const templates = await readKvCollection<TemplateRecord>(key);
    await getKv().set(key, [record, ...templates]);
  }

  return record;
}

export async function saveImportSubmission(params: {
  fileName: string;
  templates: NormalizedTemplate[];
  skippedRows: number[];
  duplicateCount: number;
  actor?: { name?: string | null; email?: string | null };
}) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("Bulk import persistence currently requires the configured Upstash KV backend.");
  }

  const now = new Date().toISOString();
  const importId = crypto.randomUUID();
  const keys = await kvKeys();
  const [existingTemplates, imports, logs] = await Promise.all([
    readKvCollection<TemplateRecord>(keys.templates),
    readKvCollection<ImportRecord>(keys.imports),
    readKvCollection<LogRecord>(keys.logs),
  ]);
  const records: TemplateRecord[] = params.templates.map((template) => ({
      id: crypto.randomUUID(),
      brand: template.brand,
      language: template.language,
      whatsappLanguage: template.whatsappLanguage,
      originalName: template.originalName,
      generatedName: template.generatedName,
      body: template.normalizedBody,
      category: template.category,
      automation: template.automation,
      status: "Pending",
      variableMappings: template.variableMappings,
      createdAt: now,
      updatedAt: now,
    }));
  const importRecord: ImportRecord = {
    id: importId,
    fileName: params.fileName,
    target: "Template Catalog",
    mode: "STRICT",
    status: "Completed",
    total: params.templates.length + params.skippedRows.length,
    submitted: 0,
    failed: 0,
    skipped: params.skippedRows.length,
    duplicates: params.duplicateCount,
    createdAt: now,
  };
  const newLogs: LogRecord[] = records.map((record) => ({
    id: crypto.randomUUID(),
    importId,
    wabaId: "",
    wabaName: "Template Catalog",
    templateName: record.generatedName,
    brand: record.brand,
    language: record.language,
    status: "Pending",
    message: "Template added to the central catalog.",
    timestamp: now,
    actorName: params.actor?.name ?? undefined,
    actorEmail: params.actor?.email ?? undefined,
  }));

  await Promise.all([
    getKv().set(keys.templates, [...records, ...existingTemplates]),
    getKv().set(keys.imports, [importRecord, ...imports]),
    getKv().set(keys.logs, [...newLogs, ...logs].slice(0, 500)),
  ]);

  return { importRecord, records };
}

export async function saveWabaAssignments(wabaId: string, sourceTemplates: TemplateRecord[]) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("WABA assignment currently requires the configured Upstash KV backend.");
  }

  const now = new Date().toISOString();
  const keys = await kvKeys();
  const [wabas, existingTemplates] = await Promise.all([
    listWabas(),
    readKvCollection<TemplateRecord>(keys.templates),
  ]);
  const wabaName = wabas.find((waba) => waba.id === wabaId)?.name ?? wabaId;
  const assignments = sourceTemplates.map((template) => ({
    ...template,
    id: crypto.randomUUID(),
    wabaId,
    wabaName,
    status: "Submitted" as const,
    createdAt: now,
    updatedAt: now,
  }));

  await getKv().set(keys.templates, [...assignments, ...existingTemplates]);
  return assignments;
}

type LogActor = { name?: string | null; email?: string | null };

async function appendTemplateLogs(
  templates: TemplateRecord[],
  status: LogRecord["status"],
  message: string,
  actor?: LogActor,
) {
  if (!hasKvConfig() || hasDatabaseUrl() || !templates.length) return;
  const keys = await kvKeys();
  const logs = await readKvCollection<LogRecord>(keys.logs);
  const now = new Date().toISOString();
  const entries: LogRecord[] = templates.map((template) => ({
    id: crypto.randomUUID(),
    importId: "",
    wabaId: template.wabaId ?? "",
    wabaName: template.wabaName ?? "Template Catalog",
    templateName: template.generatedName,
    brand: template.brand,
    language: template.language,
    status,
    message,
    timestamp: now,
    actorName: actor?.name ?? undefined,
    actorEmail: actor?.email ?? undefined,
  }));
  await getKv().set(keys.logs, [...entries, ...logs].slice(0, 500));
}

export async function deleteTemplate(id: string, actor?: LogActor) {
  if (hasDatabaseUrl()) {
    await getPrisma().template.delete({ where: { id } });
    return;
  }

  if (!hasKvConfig()) {
    throw new Error("No persistence backend is configured.");
  }

  const key = (await kvKeys()).templates;
  const templates = await readKvCollection<TemplateRecord>(key);
  const deleted = templates.find((template) => template.id === id);
  await getKv().set(
    key,
    templates.filter((template) => template.id !== id),
  );
  if (deleted) await appendTemplateLogs([deleted], "Skipped", "Template deleted from the catalog.", actor);
}

export async function deleteTemplates(ids: string[], actor?: LogActor) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("Bulk template deletion currently requires the configured Upstash KV backend.");
  }

  const key = (await kvKeys()).templates;
  const templates = await readKvCollection<TemplateRecord>(key);
  const idSet = new Set(ids);
  const deletedTemplates = templates.filter((template) => idSet.has(template.id));
  const remaining = templates.filter((template) => !idSet.has(template.id));
  await getKv().set(key, remaining);
  await appendTemplateLogs(deletedTemplates, "Skipped", "Template deleted from the catalog.", actor);
  return templates.length - remaining.length;
}

export async function updateTemplate(id: string, changes: Partial<TemplateRecord>, actor?: LogActor) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("Template editing currently requires the configured Upstash KV backend.");
  }

  const key = (await kvKeys()).templates;
  const templates = await readKvCollection<TemplateRecord>(key);
  const index = templates.findIndex((template) => template.id === id);
  if (index < 0) {
    return null;
  }

  const updated: TemplateRecord = {
    ...templates[index],
    ...changes,
    id,
    updatedAt: new Date().toISOString(),
  };
  templates[index] = updated;
  await getKv().set(key, templates);
  await appendTemplateLogs([updated], updated.status, "Template updated in the catalog.", actor);
  return updated;
}

export async function logWabaSubmissions(templates: TemplateRecord[], actor?: LogActor) {
  await appendTemplateLogs(templates, "Submitted", "Template submitted to Vonage.", actor);
}
