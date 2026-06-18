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

  it("keeps existing WhatsApp placeholders", () => {
    const result = normalizeVariables("Hello {{1}}");

    expect(result.body).toBe("Hello {{1}}");
    expect(result.mappings[0]).toMatchObject({ placeholder: "{{1}}", key: "ARG_1" });
  });

  it("normalizes triple-brace and CRM placeholders", () => {
    const result = normalizeVariables("Hi {{{Sender.FirstName}}} from {!User.FirstName}");

    expect(result.body).toBe("Hi {{1}} from {{2}}");
    expect(result.mappings.map((mapping) => mapping.key)).toEqual(["SENDER_FIRST_NAME", "USER_FIRST_NAME"]);
  });
});
