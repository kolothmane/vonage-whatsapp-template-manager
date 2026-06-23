import { describe, expect, it } from "vitest";
import {
  getAdminEmails,
  hasAllowedCompanyDomain,
  normalizeEmail,
} from "@/lib/server/admin-access";

describe("admin access helpers", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail(" Admin@BayRetail.io ")).toBe("admin@bayretail.io");
  });

  it("accepts only exact company domains", () => {
    expect(hasAllowedCompanyDomain("user@baybridgedigital.com")).toBe(true);
    expect(hasAllowedCompanyDomain("user@bayretail.io")).toBe(true);
    expect(hasAllowedCompanyDomain("user@sub.bayretail.io")).toBe(false);
    expect(hasAllowedCompanyDomain("user@bayretail.io.example.com")).toBe(false);
  });

  it("parses comma-separated admin emails", () => {
    expect(
      [...getAdminEmails(" Admin1@BayBridgeDigital.com, admin2@bayretail.io ,,")],
    ).toEqual(["admin1@baybridgedigital.com", "admin2@bayretail.io"]);
  });
});
