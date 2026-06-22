import { describe, expect, it } from "vitest";
import { normalizeVariables } from "@/lib/domain/variables";

describe("normalizeVariables", () => {
  it("converts bracket variables to WhatsApp placeholders", () => {
    const result = normalizeVariables("Hello [FIRST NAME], visit [STORE NAME].");

    expect(result.body).toBe("Hello {{1}}, visit {{2}}.");
    expect(result.mappings).toEqual([
      { placeholder: "{{1}}", key: "FIRST_NAME", source: "[FIRST NAME]" },
      { placeholder: "{{2}}", key: "STORE_NAME", source: "[STORE NAME]" },
    ]);
  });

  it("reports numbered placeholders without labels instead of inventing ARG keys", () => {
    const result = normalizeVariables("Hello {{1}}");

    expect(result.body).toBe("Hello {{1}}");
    expect(result.mappings).toEqual([]);
    expect(result.missingDefinitions).toEqual(["{{1}}"]);
  });

  it("uses labels from Body Variables for numbered placeholders", () => {
    const result = normalizeVariables(
      "Hello {{1}}, this is {{2}} from {{3}}.",
      "{{1}} Customer Name\n{{2}} Advisor Name\n{{3}} Store Name",
    );

    expect(result.mappings).toEqual([
      { placeholder: "{{1}}", key: "CUSTOMER_NAME", source: "Customer Name" },
      { placeholder: "{{2}}", key: "ADVISOR_NAME", source: "Advisor Name" },
      { placeholder: "{{3}}", key: "STORE_NAME", source: "Store Name" },
    ]);
    expect(result.missingDefinitions).toEqual([]);
  });

  it("accepts separators in Body Variables definitions", () => {
    const result = normalizeVariables(
      "Hello {{1}} from {{2}}.",
      "{{1}}: First Name\r\n{{2}} - Staff Name",
    );

    expect(result.mappings.map((mapping) => mapping.key)).toEqual(["FIRST_NAME", "STAFF_NAME"]);
  });

  it("normalizes triple-brace and CRM placeholders", () => {
    const result = normalizeVariables("Hi {{{Sender.FirstName}}} from {!User.FirstName}");

    expect(result.body).toBe("Hi {{1}} from {{2}}");
    expect(result.mappings.map((mapping) => mapping.key)).toEqual(["SENDER_FIRST_NAME", "USER_FIRST_NAME"]);
  });
});
