import type { ImportRecord, LogRecord, TemplateRecord, Waba } from "@/lib/domain/types";
import { getPrisma, hasDatabaseUrl } from "./db";

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
    return [];
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
    return [];
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
    return [];
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
    return [];
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

export async function listAuditLogs() {
  if (!hasDatabaseUrl()) {
    return [];
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
