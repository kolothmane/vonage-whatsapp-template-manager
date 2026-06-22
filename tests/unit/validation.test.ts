import { describe, expect, it } from "vitest";
import { getSubmittableTemplates, validateImportRows } from "@/lib/domain/validation";
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
          "Body Variables": "{{1}} Customer Name",
          "Template Type": "Proactive Contact",
        },
        {
          BRAND: "NR",
          Language: "ES",
          "Template Name": "Gracias por tu compra",
          "Template Body": "Hola {{1}}, gracias por tu compra.",
          "Body Variables": "{{1}} Customer Name",
          "Template Type": "Automation",
        },
      ],
      [],
      ["waba-br"],
    );

    expect(report.valid).toBe(true);
    expect(report.templates.map((template) => template.category)).toEqual(["MARKETING", "UTILITY"]);
  });

  it.each(["DBS", "JPG", "PEN", "PR", "SHA"] as const)(
    "accepts the %s brand from the WABA BR catalog",
    (brand) => {
      const report = validateImportRows(
        [
          {
            BRAND: brand,
            Language: "EN",
            "Template Name": "Catalog template",
            "Template Body": "Hello {{1}}.",
            "Body Variables": "{{1}} Customer Name",
            "Template Type": "Proactive Contact",
          },
        ],
        [],
        ["waba-br"],
      );

      expect(report.issues.some((issue) => issue.code === "UNSUPPORTED_BRAND")).toBe(false);
    },
  );

  it("maps workbook Body Variables to semantic keys", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "KA",
          Language: "ES",
          "Template Name": "Phone number change",
          "Template Body": "Dear {{1}}, this is {{2}} from {{3}}.",
          "Body Variables": "{{1}} Customer Name\n{{2}} Staff Name\n{{3}} Store",
          "Template Type": "Proactive Contact",
        },
      ],
      [],
      ["waba-br"],
    );

    expect(report.templates[0].variableMappings.map((mapping) => mapping.key)).toEqual([
      "CUSTOMER_NAME",
      "STAFF_NAME",
      "STORE",
    ]);
  });

  it("blocks numbered placeholders without explicit labels", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "KA",
          Language: "ES",
          "Template Name": "Missing variable label",
          "Template Body": "Hello {{1}} from {{2}}.",
          "Body Variables": "{{1}} Customer Name",
          "Template Type": "Proactive Contact",
        },
      ],
      [],
      ["waba-br"],
    );

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        field: "Body Variables",
        code: "MISSING_VARIABLE_LABEL",
        message: expect.stringContaining("{{2}}"),
      }),
    );
    expect(report.templates[0].variableMappings.map((mapping) => mapping.key)).toEqual(["CUSTOMER_NAME"]);
  });

  it("submits valid rows while excluding rows with errors", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "KA",
          Language: "ES",
          "Template Name": "Valid template",
          "Template Body": "Hello {{1}}.",
          "Body Variables": "{{1}} Customer Name",
          "Template Type": "Proactive Contact",
        },
        {
          BRAND: "KA",
          Language: "ES",
          "Template Name": "Invalid template",
          "Template Body": "Hello {{1}} and {{2}}.",
          "Body Variables": "{{1}} Customer Name",
          "Template Type": "Proactive Contact",
        },
      ],
      [],
      ["waba-br"],
    );

    expect(report.valid).toBe(false);
    expect(getSubmittableTemplates(report).map((template) => template.rowNumber)).toEqual([2]);
  });

  it("accepts DU catalog rows as Dutch WhatsApp templates", () => {
    const report = validateImportRows(
      [
        {
          BRAND: "PR",
          Language: "DU",
          "Template Name": "Bedankt",
          "Template Body": "Hallo {{1}}.",
          "Body Variables": "{{1}} Customer Name",
          "Template Type": "Proactive Contact",
        },
      ],
      [],
      ["waba-br"],
    );

    expect(report.valid).toBe(true);
    expect(report.templates[0]).toMatchObject({
      language: "DU",
      whatsappLanguage: "nl",
      generatedName: "pr_bedankt_nl",
    });
  });
});
