import { describe, expect, it } from "vitest";
import { STATUS_DESCRIPTIONS } from "@/lib/domain/log-statuses";
import { IMPORT_STATUSES } from "@/lib/domain/types";

describe("log status descriptions", () => {
  it("defines an explanation for every supported status", () => {
    expect(Object.keys(STATUS_DESCRIPTIONS).sort()).toEqual([...IMPORT_STATUSES].sort());
  });

  it("defines Pending as catalog-only", () => {
    expect(STATUS_DESCRIPTIONS.Pending).toContain("central catalog");
    expect(STATUS_DESCRIPTIONS.Pending).toContain("not yet submitted");
  });
});
