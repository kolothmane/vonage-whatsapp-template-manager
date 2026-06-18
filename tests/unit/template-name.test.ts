import { describe, expect, it } from "vitest";
import { generateTemplateName } from "@/lib/domain/template-name";

describe("generateTemplateName", () => {
  it("normalizes names and appends language suffix", () => {
    expect(generateTemplateName("Following up on your sample", "EN")).toBe("following_up_on_your_sample_en");
    expect(generateTemplateName("Thank you", "FR")).toBe("thank_you_fr");
    expect(generateTemplateName("(W) Beauty - Product Available", "DE")).toBe("w_beauty_product_available_de");
  });

  it("removes accents and collapses underscores", () => {
    expect(generateTemplateName("Merci, déjà prêt !", "FR")).toBe("merci_deja_pret_fr");
  });

  it("rejects unsupported languages", () => {
    expect(() => generateTemplateName("Hello", "NL")).toThrow("Unsupported language");
  });
});
