import type { NormalizedTemplate, VonageTemplatePayload } from "./types";

const VONAGE_TRAILING_PARAM_MARK = "\u200E";
const TRAILING_IGNORABLE_CHARACTERS = /[\s\u200B\u200C\u200D\u2060\uFEFF]+$/u;
const TRAILING_PLACEHOLDER = /\{\{\d+\}\}$/u;

export function ensureVonageTrailingParamMarker(body: string) {
  if (body.endsWith(VONAGE_TRAILING_PARAM_MARK)) {
    return body;
  }

  const meaningfulBody = body.replace(TRAILING_IGNORABLE_CHARACTERS, "");
  return TRAILING_PLACEHOLDER.test(meaningfulBody)
    ? `${meaningfulBody}${VONAGE_TRAILING_PARAM_MARK}`
    : body;
}

export function generateVonagePayload(template: NormalizedTemplate): VonageTemplatePayload {
  return {
    name: template.generatedName,
    language: template.whatsappLanguage,
    category: template.category,
    components: [
      {
        type: "BODY",
        text: ensureVonageTrailingParamMarker(template.normalizedBody),
        example: template.variableMappings.length
          ? {
              body_text: [
                template.variableMappings.map((mapping) =>
                  mapping.key
                    .replace(/_/g, " ")
                    .toLowerCase()
                    .replace(/^\w/, (char) => char.toUpperCase()),
                ),
              ],
            }
          : undefined,
      },
    ],
    metadata: {
      brand: template.brand,
      automation: template.automation,
      variable_mappings: template.variableMappings,
    },
  };
}
