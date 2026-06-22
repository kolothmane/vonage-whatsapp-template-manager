import { describe, expect, it } from "vitest";
import { normalizeImportRows } from "@/lib/domain/import-normalization";

describe("normalizeImportRows", () => {
  it("normalizes the WABA BR workbook and skips non-template rows", () => {
    const rows = normalizeImportRows([
      {
        BRAND: " LAP ",
        Language: " ES ",
        "Template Name": "POST PURCHASE 1",
        "Template Description": " Apres-Achat 1 ",
        "Template Body": " Bonjour {{1}} ",
        "Template Type": " Automation ",
        "Unnamed: 13": "ignored",
      },
      {
        BRAND: "LAP",
        Language: "ES",
        "Template Name": "",
        "Template Body": "",
        "Template Type": "Free Text",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]["Template Name"]).toBe("Apres-Achat 1");
    expect(rows[0]["Template Body"]).toBe("Bonjour {{1}}");
    expect(rows[0].__sourceRow).toBe(2);
    expect(rows[0]).not.toHaveProperty("Unnamed: 13");
  });
});
