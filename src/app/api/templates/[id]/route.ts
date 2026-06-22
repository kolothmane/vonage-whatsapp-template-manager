import { NextResponse } from "next/server";
import { generateTemplateName } from "@/lib/domain/template-name";
import { normalizeVariables } from "@/lib/domain/variables";
import {
  SUPPORTED_BRANDS,
  SUPPORTED_LANGUAGES,
  TEMPLATE_CATEGORIES,
  LANGUAGE_MAP,
  type SupportedBrand,
  type SupportedLanguage,
  type TemplateCategory,
} from "@/lib/domain/types";
import { deleteTemplate, updateTemplate } from "@/lib/server/repository";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    await deleteTemplate(id);
    return NextResponse.json({ data: { id }, message: "Template deleted." });
  } catch (error) {
    return NextResponse.json(
      {
        error: "PERSISTENCE_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Template deletion failed.",
      },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    brand?: string;
    language?: string;
    originalName?: string;
    body?: string;
    category?: string;
    automation?: string;
    bodyVariables?: string;
  };
  const brand = body.brand?.trim().toUpperCase();
  const language = body.language?.trim().toUpperCase();
  const originalName = body.originalName?.trim();
  const templateBody = body.body?.trim();
  const category = body.category?.trim().toUpperCase();

  if (!brand || !SUPPORTED_BRANDS.includes(brand as SupportedBrand)) {
    return NextResponse.json({ error: "INVALID_BRAND", message: "Select a supported brand." }, { status: 400 });
  }
  if (!language || !SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
    return NextResponse.json({ error: "INVALID_LANGUAGE", message: "Select a supported language." }, { status: 400 });
  }
  if (!originalName || !templateBody || !category || !TEMPLATE_CATEGORIES.includes(category as TemplateCategory)) {
    return NextResponse.json({ error: "INVALID_TEMPLATE", message: "Name, body and category are required." }, { status: 400 });
  }

  const variables = normalizeVariables(templateBody, body.bodyVariables);
  if (variables.missingDefinitions.length) {
    return NextResponse.json(
      { error: "MISSING_VARIABLE_LABEL", message: `Missing labels for ${variables.missingDefinitions.join(", ")}.` },
      { status: 422 },
    );
  }

  const updated = await updateTemplate(id, {
    brand: brand as SupportedBrand,
    language: language as SupportedLanguage,
    whatsappLanguage: LANGUAGE_MAP[language as SupportedLanguage],
    originalName,
    generatedName: generateTemplateName(originalName, language),
    body: variables.body,
    category: category as TemplateCategory,
    automation: body.automation?.trim() || "Manual",
    variableMappings: variables.mappings,
  });
  if (!updated) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Template not found." }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}
