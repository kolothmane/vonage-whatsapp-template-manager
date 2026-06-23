import { describe, expect, it } from "vitest";
import {
  ensureVonageTrailingParamMarker,
  generateVariableExample,
  generateVonagePayload,
} from "@/lib/domain/payload";
import type { NormalizedTemplate } from "@/lib/domain/types";

describe("Vonage payload", () => {
  it("adds U+200E when the body ends with a placeholder", () => {
    expect(ensureVonageTrailingParamMarker("Thank you\n\n{{2}}\n{{3}}")).toBe(
      "Thank you\n\n{{2}}\n{{3}}\u200E",
    );
  });

  it("replaces trailing whitespace and zero-width spaces with one marker", () => {
    expect(ensureVonageTrailingParamMarker("Thank you {{1}}\n\u200B ")).toBe(
      "Thank you {{1}}\u200E",
    );
  });

  it("does not alter a body ending with visible text", () => {
    expect(ensureVonageTrailingParamMarker("Hello {{1}}, thank you.")).toBe(
      "Hello {{1}}, thank you.",
    );
  });

  it("does not append the marker twice", () => {
    expect(ensureVonageTrailingParamMarker("Thank you {{1}}\u200E")).toBe(
      "Thank you {{1}}\u200E",
    );
  });

  it("applies the marker only to the generated API payload", () => {
    const template: NormalizedTemplate = {
      rowNumber: 1,
      brand: "AB",
      language: "EN",
      whatsappLanguage: "en",
      originalName: "Follow up",
      generatedName: "follow_up_en",
      body: "Thank you {{1}}",
      normalizedBody: "Thank you {{1}}",
      category: "MARKETING",
      automation: "Manual",
      variableMappings: [
        { placeholder: "{{1}}", key: "customer_name", source: "Customer Name" },
      ],
    };

    const payload = generateVonagePayload(template);
    expect(payload.components[0].text).toBe("Thank you {{1}}\u200E");
    expect(template.normalizedBody).toBe("Thank you {{1}}");
  });

  it("uses realistic examples for names and the template brand for store name", () => {
    expect(
      generateVariableExample(
        { placeholder: "{{1}}", key: "FIRST_NAME", source: "First Name" },
        "AB",
      ),
    ).toBe("Mia");
    expect(
      generateVariableExample(
        { placeholder: "{{2}}", key: "SENDER_FIRST_NAME", source: "Sender First Name" },
        "AB",
      ),
    ).toBe("Ana");
    expect(
      generateVariableExample(
        { placeholder: "{{3}}", key: "STORE_NAME", source: "Store Name" },
        "AB",
      ),
    ).toBe("AB");
  });

  it("writes the examples in placeholder order in the Vonage payload", () => {
    const template: NormalizedTemplate = {
      rowNumber: 1,
      brand: "CH",
      language: "EN",
      whatsappLanguage: "en",
      originalName: "Store follow up",
      generatedName: "store_follow_up_en",
      body: "Dear {{1}}, contact {{2}} at {{3}}.",
      normalizedBody: "Dear {{1}}, contact {{2}} at {{3}}.",
      category: "MARKETING",
      automation: "Manual",
      variableMappings: [
        { placeholder: "{{1}}", key: "FIRST_NAME", source: "First Name" },
        { placeholder: "{{2}}", key: "SENDER_FIRST_NAME", source: "Sender First Name" },
        { placeholder: "{{3}}", key: "STORE_NAME", source: "Store Name" },
      ],
    };

    expect(generateVonagePayload(template).components[0].example?.body_text).toEqual([
      ["Mia", "Ana", "CH"],
    ]);
  });
});
