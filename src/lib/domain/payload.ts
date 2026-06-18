import type { NormalizedTemplate, VonageTemplatePayload } from "./types";

export function generateVonagePayload(template: NormalizedTemplate): VonageTemplatePayload {
  return {
    name: template.generatedName,
    language: template.whatsappLanguage,
    category: template.category,
    components: [
      {
        type: "BODY",
        text: template.normalizedBody,
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
