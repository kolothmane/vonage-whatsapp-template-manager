import { describe, expect, it } from "vitest";
import { suggestTemplatesForWaba } from "@/lib/domain/template-suggestions";
import type { TemplateRecord } from "@/lib/domain/types";

function template(id: string, brand: TemplateRecord["brand"], language: TemplateRecord["language"]): TemplateRecord {
  return {
    id,
    brand,
    language,
    whatsappLanguage: language === "DU" ? "nl" : language.toLowerCase() as TemplateRecord["whatsappLanguage"],
    originalName: id,
    generatedName: id,
    body: "Hello",
    category: "MARKETING",
    automation: "Manual",
    status: "Pending",
    variableMappings: [],
    createdAt: "",
    updatedAt: "",
  };
}

describe("suggestTemplatesForWaba", () => {
  const templates = [
    template("lap-fr", "LAP", "FR"),
    template("lap-en", "LAP", "EN"),
    template("pr-fr", "PR", "FR"),
  ];

  it("matches both explicit brand and language tokens", () => {
    const result = suggestTemplatesForWaba({ id: "waba-lap-fr", name: "LAP France FR" }, templates);
    expect(result.map((item) => item.id)).toEqual(["lap-fr"]);
  });

  it("matches all brand templates when no language token exists", () => {
    const result = suggestTemplatesForWaba({ id: "waba-lap", name: "LAP Europe" }, templates);
    expect(result.map((item) => item.id)).toEqual(["lap-fr", "lap-en"]);
  });

  it("does not preselect anything without explicit brand or language tokens", () => {
    expect(suggestTemplatesForWaba({ id: "123", name: "Main account" }, templates)).toEqual([]);
  });
});
