export const ALLOWED_EMAIL_DOMAINS = ["baybridgedigital.com", "bayretail.io"] as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hasAllowedCompanyDomain(email?: string | null) {
  if (!email) {
    return false;
  }

  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");
  return parts.length === 2 && ALLOWED_EMAIL_DOMAINS.some((domain) => parts[1] === domain);
}

export function getAdminEmails(value = process.env.ADMIN_EMAILS) {
  return new Set(
    (value ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isAdminEmail(email?: string | null) {
  return Boolean(email && getAdminEmails().has(normalizeEmail(email)));
}
