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

const KV_KEYS = {
  wabas: "waba-br:wabas",
  templates: "waba-br:templates",
  imports: "waba-br:imports",
  logs: "waba-br:logs",
  auditLogs: "waba-br:audit-logs",
} as const;

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
    const wabas = await readKvCollection<Waba>(KV_KEYS.wabas);
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
    const templates = await readKvCollection<TemplateRecord>(KV_KEYS.templates);
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
    const imports = await readKvCollection<ImportRecord>(KV_KEYS.imports);
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
    const logs = await readKvCollection<LogRecord>(KV_KEYS.logs);
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
    const logs = await readKvCollection<AuditLogRecord>(KV_KEYS.auditLogs);
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
    await getKv().set(KV_KEYS.wabas, wabas);
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
    const templates = await readKvCollection<TemplateRecord>(KV_KEYS.templates);
    await getKv().set(KV_KEYS.templates, [record, ...templates]);
  }

  return record;
}

export async function saveImportSubmission(params: {
  fileName: string;
  templates: NormalizedTemplate[];
  skippedRows: number[];
  duplicateCount: number;
}) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("Bulk import persistence currently requires the configured Upstash KV backend.");
  }

  const now = new Date().toISOString();
  const importId = crypto.randomUUID();
  const [existingTemplates, imports, logs] = await Promise.all([
    readKvCollection<TemplateRecord>(KV_KEYS.templates),
    readKvCollection<ImportRecord>(KV_KEYS.imports),
    readKvCollection<LogRecord>(KV_KEYS.logs),
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
  }));

  await Promise.all([
    getKv().set(KV_KEYS.templates, [...records, ...existingTemplates]),
    getKv().set(KV_KEYS.imports, [importRecord, ...imports]),
    getKv().set(KV_KEYS.logs, [...newLogs, ...logs].slice(0, 500)),
  ]);

  return { importRecord, records };
}

export async function saveWabaAssignments(wabaId: string, sourceTemplates: TemplateRecord[]) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("WABA assignment currently requires the configured Upstash KV backend.");
  }

  const now = new Date().toISOString();
  const [wabas, existingTemplates] = await Promise.all([
    listWabas(),
    readKvCollection<TemplateRecord>(KV_KEYS.templates),
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

  await getKv().set(KV_KEYS.templates, [...assignments, ...existingTemplates]);
  return assignments;
}

export async function deleteTemplate(id: string) {
  if (hasDatabaseUrl()) {
    await getPrisma().template.delete({ where: { id } });
    return;
  }

  if (!hasKvConfig()) {
    throw new Error("No persistence backend is configured.");
  }

  const templates = await readKvCollection<TemplateRecord>(KV_KEYS.templates);
  await getKv().set(
    KV_KEYS.templates,
    templates.filter((template) => template.id !== id),
  );
}

export async function deleteTemplates(ids: string[]) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("Bulk template deletion currently requires the configured Upstash KV backend.");
  }

  const templates = await readKvCollection<TemplateRecord>(KV_KEYS.templates);
  const idSet = new Set(ids);
  const remaining = templates.filter((template) => !idSet.has(template.id));
  await getKv().set(KV_KEYS.templates, remaining);
  return templates.length - remaining.length;
}

export async function updateTemplate(id: string, changes: Partial<TemplateRecord>) {
  if (!hasKvConfig() || hasDatabaseUrl()) {
    throw new Error("Template editing currently requires the configured Upstash KV backend.");
  }

  const templates = await readKvCollection<TemplateRecord>(KV_KEYS.templates);
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
  await getKv().set(KV_KEYS.templates, templates);
  return updated;
}
