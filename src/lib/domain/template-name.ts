import { LANGUAGE_MAP, SUPPORTED_LANGUAGES, type SupportedLanguage } from "./types";

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value.trim().toUpperCase() as SupportedLanguage);
}

export function normalizeTemplateName(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "template";
}

export function generateTemplateName(originalName: string, language: string): string {
  if (!isSupportedLanguage(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const suffix = LANGUAGE_MAP[language.trim().toUpperCase() as SupportedLanguage];
  const base = normalizeTemplateName(originalName);
  return base.endsWith(`_${suffix}`) ? base : `${base}_${suffix}`;
}
