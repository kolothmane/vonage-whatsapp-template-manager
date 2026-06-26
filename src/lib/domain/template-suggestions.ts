import { SUPPORTED_BRANDS, SUPPORTED_LANGUAGES, type TemplateRecord, type Waba } from "./types";

const LANGUAGE_NAMES: Record<string, string[]> = {
  EN: ["EN", "ENGLISH"],
  FR: ["FR", "FRENCH", "FRANCAIS"],
  ES: ["ES", "SPANISH", "ESPANOL"],
  PT: ["PT", "PORTUGUESE", "PORTUGUES"],
  IT: ["IT", "ITALIAN"],
  DE: ["DE", "GERMAN"],
  DU: ["DU", "DUTCH", "NEDERLANDS", "NL"],
};

function tokens(value: string) {
  return new Set(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean),
  );
}

export function suggestTemplatesForWaba(waba: Pick<Waba, "id" | "name" | "brand" | "languagePriority">, templates: TemplateRecord[]) {
  const wabaTokens = tokens(`${waba.name} ${waba.id}`);
  const brands = waba.brand ? [waba.brand] : SUPPORTED_BRANDS.filter((brand) => wabaTokens.has(brand));
  const languages = waba.languagePriority
    ? [waba.languagePriority]
    : SUPPORTED_LANGUAGES.filter((language) =>
        LANGUAGE_NAMES[language].some((name) => wabaTokens.has(name)),
      );

  return templates.filter((template) => {
    const brandMatches = brands.length === 0 || brands.includes(template.brand);
    const languageMatches = languages.length === 0 || languages.includes(template.language);
    return (brands.length > 0 || languages.length > 0) && brandMatches && languageMatches;
  });
}
