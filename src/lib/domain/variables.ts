import type { VariableMapping } from "./types";

const KNOWN_VARIABLES: Record<string, string> = {
  "[FIRST NAME]": "FIRST_NAME",
  "[STORE NAME]": "STORE_NAME",
  "[ADVISOR NAME]": "ADVISOR_NAME",
  "[STAFF NAME]": "STAFF_NAME",
  "{{{SENDER.FIRSTNAME}}}": "SENDER_FIRST_NAME",
  "{{{ACCOUNT.NAME}}}": "ACCOUNT_NAME",
  "{!USER.FIRSTNAME}": "USER_FIRST_NAME",
};

const VARIABLE_PATTERN =
  /\[(?:FIRST NAME|STORE NAME|ADVISOR NAME|STAFF NAME)\]|\{\{\d+\}\}|\{\{\{[^}]+\}\}\}|\{![^}]+\}/gi;
const SINGLE_VARIABLE_PATTERN =
  /^(?:\[(?:FIRST NAME|STORE NAME|ADVISOR NAME|STAFF NAME)\]|\{\{\d+\}\}|\{\{\{[^}]+\}\}\}|\{![^}]+\})$/i;

function normalizeKey(source: string): string {
  const upper = source.trim().toUpperCase();
  if (KNOWN_VARIABLES[upper]) {
    return KNOWN_VARIABLES[upper];
  }

  const existingPlaceholder = upper.match(/^\{\{(\d+)\}\}$/);
  if (existingPlaceholder) {
    return `ARG_${existingPlaceholder[1]}`;
  }

  return upper
    .replace(/^\[|\]$/g, "")
    .replace(/^\{\{\{|\}\}\}$/g, "")
    .replace(/^\{!|\}$/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseVariableDefinitions(definitions?: string): Map<string, string> {
  const labels = new Map<string, string>();

  for (const line of definitions?.split(/\r?\n/) ?? []) {
    const match = line.trim().match(/^\{\{(\d+)\}\}\s*[:=\-]?\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = match[2].trim();
    if (label) {
      labels.set(match[1], label);
    }
  }

  return labels;
}

export function normalizeVariables(
  body: string,
  definitions?: string,
): { body: string; mappings: VariableMapping[]; missingDefinitions: `{{${number}}}`[] } {
  const mappings: VariableMapping[] = [];
  const missingDefinitions: `{{${number}}}`[] = [];
  const sourceToPlaceholder = new Map<string, `{{${number}}}`>();
  const definitionLabels = parseVariableDefinitions(definitions);
  let index = 1;

  const normalizedBody = body.replace(VARIABLE_PATTERN, (match) => {
    const source = match.trim();
    const canonical = source.toUpperCase();
    const existing = source.match(/^\{\{(\d+)\}\}$/);

    if (existing) {
      const placeholder = `{{${existing[1]}}}` as `{{${number}}}`;
      if (!mappings.some((mapping) => mapping.placeholder === placeholder)) {
        const label = definitionLabels.get(existing[1]);
        if (label) {
          mappings.push({
            placeholder,
            key: normalizeKey(label),
            source: label,
          });
        } else if (!missingDefinitions.includes(placeholder)) {
          missingDefinitions.push(placeholder);
        }
      }
      return placeholder;
    }

    if (!sourceToPlaceholder.has(canonical)) {
      const placeholder = `{{${index}}}` as `{{${number}}}`;
      sourceToPlaceholder.set(canonical, placeholder);
      mappings.push({
        placeholder,
        key: normalizeKey(source),
        source,
      });
      index += 1;
    }

    return sourceToPlaceholder.get(canonical)!;
  });

  return {
    body: normalizedBody,
    mappings: mappings.sort(sortByPlaceholder),
    missingDefinitions: missingDefinitions.sort(
      (a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")),
    ),
  };
}

export function hasInvalidPlaceholderSyntax(body: string): boolean {
  const suspicious = body.match(/\{+\s*[^{}\s]+\s*\}+|\[[^\]]+\]|\{![^}]+/g) ?? [];
  return suspicious.some((token) => !SINGLE_VARIABLE_PATTERN.test(token));
}

function sortByPlaceholder(a: VariableMapping, b: VariableMapping) {
  return Number(a.placeholder.replace(/\D/g, "")) - Number(b.placeholder.replace(/\D/g, ""));
}
