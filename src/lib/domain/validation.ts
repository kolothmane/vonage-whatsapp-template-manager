import { z } from "zod";
import { generateTemplateName } from "./template-name";
import { hasInvalidPlaceholderSyntax, normalizeVariables } from "./variables";
import {
  LANGUAGE_MAP,
  SUPPORTED_BRANDS,
  SUPPORTED_LANGUAGES,
  TEMPLATE_CATEGORIES,
  type ImportRow,
  type NormalizedTemplate,
  type SupportedBrand,
  type SupportedLanguage,
  type TemplateCategory,
  type TemplateRecord,
  type ValidationIssue,
  type ValidationReport,
} from "./types";

export const REQUIRED_COLUMNS = [
  "BRAND",
  "Language",
  "Template Name",
  "Template Body",
  "Template Type",
] as const;

const importRowSchema = z.object({
  BRAND: z.string().trim().min(1, "Brand is required."),
  Language: z.string().trim().min(1, "Language is required."),
  "Template Name": z.string().trim().min(1, "Template Name is required."),
  "Template Body": z.string().trim().min(1, "Template Body is required."),
  "Body Variables": z.string().optional(),
  "Body Parameters": z.string().optional(),
  "Template Type": z.string().min(1),
  Automation: z.string().optional(),
});

const CATEGORY_ALIASES: Record<string, TemplateCategory> = {
  MARKETING: "MARKETING",
  UTILITY: "UTILITY",
  AUTHENTICATION: "AUTHENTICATION",
  "PROACTIVE CONTACT": "MARKETING",
  AUTOMATION: "UTILITY",
};

export function validateSpreadsheetStructure(rows: Record<string, unknown>[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const columns = new Set(Object.keys(rows[0] ?? {}));

  for (const column of REQUIRED_COLUMNS) {
    if (!columns.has(column)) {
      issues.push({
        severity: "ERROR",
        code: "MISSING_COLUMN",
        field: column,
        message: `Mandatory column missing: ${column}.`,
      });
    }
  }

  return issues;
}

export function validateImportRows(
  rawRows: Record<string, unknown>[],
  existingTemplates: Pick<TemplateRecord, "wabaId" | "wabaName" | "generatedName">[],
  targetWabaIds: string[],
): ValidationReport {
  const issues: ValidationIssue[] = validateSpreadsheetStructure(rawRows);
  const templates: NormalizedTemplate[] = [];
  const seenInBatch = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const sourceRow = Number(rawRow.__sourceRow);
    const rowNumber = Number.isInteger(sourceRow) && sourceRow >= 2 ? sourceRow : index + 2;
    const result = importRowSchema.safeParse(rawRow);

    if (!result.success) {
      for (const problem of result.error.issues) {
        issues.push({
          rowNumber,
          field: String(problem.path[0] ?? "row"),
          severity: "ERROR",
          code: "INVALID_FIELD",
          message: problem.message,
        });
      }
      return;
    }

    const row = result.data as ImportRow;
    const brand = row.BRAND.trim().toUpperCase();
    const language = row.Language.trim().toUpperCase();
    const rawCategory = row["Template Type"].trim().toUpperCase();
    const category = CATEGORY_ALIASES[rawCategory];

    if (!SUPPORTED_BRANDS.includes(brand as SupportedBrand)) {
      issues.push({
        rowNumber,
        field: "BRAND",
        severity: "ERROR",
        code: "UNSUPPORTED_BRAND",
        message: `Unsupported brand: ${row.BRAND}.`,
      });
    }

    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
      issues.push({
        rowNumber,
        field: "Language",
        severity: "ERROR",
        code: "UNSUPPORTED_LANGUAGE",
        message: `Unsupported language: ${row.Language}.`,
      });
      return;
    }

    if (!category || !TEMPLATE_CATEGORIES.includes(category)) {
      issues.push({
        rowNumber,
        field: "Template Type",
        severity: "ERROR",
        code: "INVALID_CATEGORY",
        message: `Unsupported template type: ${row["Template Type"]}. Expected Proactive Contact, Automation, MARKETING, UTILITY or AUTHENTICATION.`,
      });
    }

    if (row["Template Body"].length > 1024) {
      issues.push({
        rowNumber,
        field: "Template Body",
        severity: "ERROR",
        code: "BODY_TOO_LONG",
        message: "Template body exceeds WhatsApp body length controls.",
      });
    }

    if (hasInvalidPlaceholderSyntax(row["Template Body"])) {
      issues.push({
        rowNumber,
        field: "Template Body",
        severity: "ERROR",
        code: "INVALID_PLACEHOLDER",
        message: "Invalid placeholder syntax detected.",
      });
    }

    let generatedName = "";
    try {
      generatedName = generateTemplateName(`${brand} ${row["Template Name"]}`, language);
    } catch (error) {
      issues.push({
        rowNumber,
        field: "Template Name",
        severity: "ERROR",
        code: "NAME_GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Template name generation failed.",
      });
      return;
    }

    for (const wabaId of targetWabaIds) {
      const duplicate = existingTemplates.find(
        (template) => template.wabaId === wabaId && template.generatedName === generatedName,
      );
      const batchKey = `${wabaId}:${generatedName}`;

      if (duplicate) {
        issues.push({
          rowNumber,
          field: "Template Name",
          severity: "ERROR",
          code: "DUPLICATE_TEMPLATE",
          message: `Duplicate template detected: ${generatedName} already exists in WABA ${duplicate.wabaName}. Submission blocked.`,
        });
      }

      if (seenInBatch.has(batchKey)) {
        issues.push({
          rowNumber,
          field: "Template Name",
          severity: "ERROR",
          code: "BATCH_DUPLICATE",
          message: `Duplicate template detected in this batch for ${generatedName}. Submission blocked.`,
        });
      }

      seenInBatch.add(batchKey);
    }

    const variableResult = normalizeVariables(
      row["Template Body"],
      row["Body Variables"] || row["Body Parameters"],
    );
    templates.push({
      rowNumber,
      brand: brand as SupportedBrand,
      language: language as SupportedLanguage,
      whatsappLanguage: LANGUAGE_MAP[language as SupportedLanguage],
      originalName: row["Template Name"],
      generatedName,
      body: row["Template Body"],
      normalizedBody: variableResult.body,
      category: category ?? "MARKETING",
      automation: row.Automation?.trim() || "Manual",
      variableMappings: variableResult.mappings,
    });
  });

  const errors = issues.filter((issue) => issue.severity === "ERROR").length;
  const warnings = issues.filter((issue) => issue.severity === "WARNING").length;
  const infos = issues.filter((issue) => issue.severity === "INFO").length;
  const duplicates = issues.filter((issue) =>
    ["DUPLICATE_TEMPLATE", "BATCH_DUPLICATE"].includes(issue.code),
  ).length;

  return {
    valid: errors === 0,
    summary: {
      totalRows: rawRows.length,
      errors,
      warnings,
      infos,
      duplicates,
    },
    issues,
    templates,
  };
}
