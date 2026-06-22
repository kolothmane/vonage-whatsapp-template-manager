import { describe, expect, it } from "vitest";
import { validateImportRows } from "@/lib/domain/validation";
import type { TemplateRecord } from "@/lib/domain/types";

const existingTemplates: TemplateRecord[] = [
  {
    id: "existing-template",
    wabaId: "waba_ab_fr",
    wabaName: "Existing WABA",
    brand: "AB",
    language: "EN",
    whatsappLanguage: "en",
    originalName: "Following up on your sample",
    generatedName: "ab_following_up_on_your_sample_en",
    body: "Hello {{1}}",
    category: "MARKETING",
    automation: "Manual",
    status: "Approved",
    variableMappings: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("validateImportRows", () => {
  it("blocks duplicates in strict mode", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "AB",
          Language: "EN",
          Template: "Sample follow up",
          "Template Name": "Following up on your sample",
          "Template Body": "Hello [FIRST NAME]",
          "Template Type": "MARKETING",
        },
      ],
      existingTemplates,
      ["waba_ab_fr"],
    );

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === "DUPLICATE_TEMPLATE")).toBe(true);
  });

  it("rejects unsupported languages", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "AB",
          Language: "NL",
          Template: "Greeting",
          "Template Name": "Greeting",
          "Template Body": "Hello",
          "Template Type": "MARKETING",
        },
      ],
      [],
      ["waba_ab_fr"],
    );

    expect(report.valid).toBe(false);
    expect(report.issues.some((issue) => issue.code === "UNSUPPORTED_LANGUAGE")).toBe(true);
  });

  it("passes a valid row and normalizes body variables", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "AD",
          Language: "IT",
          Template: "Greeting",
          "Template Name": "Welcome Client",
          "Template Body": "Ciao [FIRST NAME], visita [STORE NAME].",
          "Template Type": "UTILITY",
        },
      ],
      [],
      ["waba_ab_fr"],
    );

    expect(report.valid).toBe(true);
    expect(report.templates[0].generatedName).toBe("ad_welcome_client_it");
    expect(report.templates[0].normalizedBody).toBe("Ciao {{1}}, visita {{2}}.");
  });

  it("accepts WABA BR workbook brands and maps business template types", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "LAP",
          Language: "ES",
          "Template Name": "Cambio de numero de telefono",
          "Template Body": "Hola {{1}}, este es mi nuevo numero.",
          "Template Type": "Proactive Contact",
        },
        {
          BRAND: "NR",
          Language: "ES",
          "Template Name": "Gracias por tu compra",
          "Template Body": "Hola {{1}}, gracias por tu compra.",
          "Template Type": "Automation",
        },
      ],
      [],
      ["waba-br"],
    );

    expect(report.valid).toBe(true);
    expect(report.templates.map((template) => template.category)).toEqual(["MARKETING", "UTILITY"]);
  });
});
