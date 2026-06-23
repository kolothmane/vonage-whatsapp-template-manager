import { hasAllowedCompanyDomain, normalizeEmail } from "@/lib/server/admin-access";
import { getKv, hasKvConfig } from "@/lib/server/kv";

export type WhitelistEntry = {
  id: string;
  email: string;
  createdBy: string;
  createdAt: string;
};

const WHITELIST_KEY = "waba-br:allowed-user-emails";

function requireKv() {
  if (!hasKvConfig()) {
    throw new Error("Upstash KV is required for whitelist management.");
  }
}

async function readEntries() {
  requireKv();
  return (await getKv().get<WhitelistEntry[]>(WHITELIST_KEY)) ?? [];
}

export async function isWhitelistedEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const entries = await readEntries();
  return entries.some((entry) => entry.email === normalizedEmail);
}

export async function listWhitelistedEmails(): Promise<WhitelistEntry[]> {
  return (await readEntries()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addWhitelistedEmail(email: string, createdBy: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!hasAllowedCompanyDomain(normalizedEmail)) {
    throw new Error("Email must belong to baybridgedigital.com or bayretail.io.");
  }

  const entries = await readEntries();
  if (entries.some((entry) => entry.email === normalizedEmail)) {
    throw new Error("This email is already whitelisted.");
  }

  const entry: WhitelistEntry = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    createdBy: normalizeEmail(createdBy),
    createdAt: new Date().toISOString(),
  };
  await getKv().set(WHITELIST_KEY, [entry, ...entries]);
  return entry;
}

export async function removeWhitelistedEmail(id: string) {
  const entries = await readEntries();
  const nextEntries = entries.filter((entry) => entry.id !== id);
  if (nextEntries.length === entries.length) {
    throw new Error("Whitelist entry not found.");
  }

  await getKv().set(WHITELIST_KEY, nextEntries);
}
