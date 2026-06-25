import { cookies } from "next/headers";
import { auth } from "@/auth";
import { decryptSecret, encryptSecret } from "@/lib/server/encryption";
import { getKv } from "@/lib/server/kv";
import { isAdminEmail, normalizeEmail } from "@/lib/server/admin-access";

const ENVIRONMENTS_KEY = "waba-br:environments";
const ACTIVE_COOKIE = "waba-br-environment";
const PUIG_PROD_ENVIRONMENT_NAME = "PUIG Prod";

export type EnvironmentRecord = {
  id: string;
  name: string;
  apiKey: string;
  apiSecret: string;
  applicationId: string;
  privateKey: string;
  vcrCredentialName?: string;
  userEmails: string[];
  archivedAt?: string;
  createdAt: string;
  createdBy: string;
};

export type SafeEnvironment = Omit<EnvironmentRecord, "apiKey" | "apiSecret" | "applicationId" | "privateKey" | "vcrCredentialName"> & {
  credentialsConfigured: true;
  manualWabaIds: string[];
  vcrCredentialConfigured: boolean;
};

function envBackedAdmins() {
  return [
    ...new Set(
      (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map(normalizeEmail)
        .filter(Boolean),
    ),
  ];
}

async function withEnvBackedEnvironments(environments: EnvironmentRecord[]) {
  const puigApiKey = process.env.PUIG_API?.trim();
  const puigApiSecret = process.env.PUIG_PRODD?.trim();
  if (!puigApiKey || !puigApiSecret) {
    return environments;
  }

  if (environments.some((environment) => environment.name === PUIG_PROD_ENVIRONMENT_NAME && !environment.archivedAt)) {
    return environments;
  }

  const admins = envBackedAdmins();
  const createdBy = admins[0] ?? "system";
  const environment: EnvironmentRecord = {
    id: crypto.randomUUID(),
    name: PUIG_PROD_ENVIRONMENT_NAME,
    apiKey: encryptSecret(puigApiKey),
    apiSecret: encryptSecret(puigApiSecret),
    applicationId: encryptSecret(""),
    privateKey: encryptSecret(""),
    vcrCredentialName: encryptSecret(""),
    userEmails: admins,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  const next = [...environments, environment];
  await getKv().set(ENVIRONMENTS_KEY, next);
  return next;
}

async function allEnvironments() {
  const environments = (await getKv().get<EnvironmentRecord[]>(ENVIRONMENTS_KEY)) ?? [];
  return withEnvBackedEnvironments(environments);
}

function decryptOptionalSecret(value: string | undefined) {
  return value ? decryptSecret(value) : "";
}

export async function listEnvironmentsForUser(email: string) {
  const normalized = normalizeEmail(email);
  const admin = isAdminEmail(normalized);
  const environments = (await allEnvironments())
    .filter((environment) => !environment.archivedAt && (admin || environment.userEmails.includes(normalized)));
  return Promise.all(environments.map(async (environment) => ({
      id: environment.id,
      name: environment.name,
      userEmails: environment.userEmails,
      archivedAt: environment.archivedAt,
      createdAt: environment.createdAt,
      createdBy: environment.createdBy,
      credentialsConfigured: true as const,
      vcrCredentialConfigured: Boolean(decryptOptionalSecret(environment.vcrCredentialName)),
      manualWabaIds:
        (await getKv().get<string[]>(environmentKey(environment.id, "manual-waba-ids"))) ?? [],
    })));
}

export async function getActiveEnvironmentIdForUser(email: string) {
  const accessible = await listEnvironmentsForUser(email);
  const selectedId = (await cookies()).get(ACTIVE_COOKIE)?.value;
  return accessible.find((item) => item.id === selectedId)?.id ?? accessible[0]?.id ?? "";
}

export async function createEnvironment(input: {
  name: string; apiKey: string; apiSecret: string; applicationId?: string; privateKey?: string; vcrCredentialName?: string; createdBy: string;
}) {
  const environments = await allEnvironments();
  const environment: EnvironmentRecord = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    apiKey: encryptSecret(input.apiKey.trim()),
    apiSecret: encryptSecret(input.apiSecret.trim()),
    applicationId: encryptSecret(input.applicationId?.trim() ?? ""),
    privateKey: encryptSecret(input.privateKey?.trim() ?? ""),
    vcrCredentialName: encryptSecret(input.vcrCredentialName?.trim() ?? ""),
    userEmails: [normalizeEmail(input.createdBy)],
    createdAt: new Date().toISOString(),
    createdBy: normalizeEmail(input.createdBy),
  };
  await getKv().set(ENVIRONMENTS_KEY, [...environments, environment]);
  return environment.id;
}

export async function assignEnvironmentUsers(id: string, emails: string[]) {
  const environments = await allEnvironments();
  const environment = environments.find((item) => item.id === id);
  if (!environment) throw new Error("Environment not found.");
  environment.userEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  await getKv().set(ENVIRONMENTS_KEY, environments);
}

export async function archiveEnvironment(id: string) {
  const environments = await allEnvironments();
  const environment = environments.find((item) => item.id === id);
  if (!environment) throw new Error("Environment not found.");
  environment.archivedAt = new Date().toISOString();
  await getKv().set(ENVIRONMENTS_KEY, environments);
}

export async function renameEnvironment(id: string, name: string) {
  const environments = await allEnvironments();
  const environment = environments.find((item) => item.id === id);
  if (!environment) throw new Error("Environment not found.");
  environment.name = name.trim();
  await getKv().set(ENVIRONMENTS_KEY, environments);
}

export async function updateEnvironmentCredentials(
  id: string,
  input: { apiKey: string; apiSecret: string; applicationId?: string; privateKey?: string; vcrCredentialName?: string },
) {
  const environments = await allEnvironments();
  const environment = environments.find((item) => item.id === id && !item.archivedAt);
  if (!environment) throw new Error("Environment not found.");
  environment.apiKey = encryptSecret(input.apiKey.trim());
  environment.apiSecret = encryptSecret(input.apiSecret.trim());
  environment.applicationId = encryptSecret(input.applicationId?.trim() ?? "");
  environment.privateKey = encryptSecret(input.privateKey?.trim() ?? "");
  environment.vcrCredentialName = encryptSecret(input.vcrCredentialName?.trim() ?? "");
  await getKv().set(ENVIRONMENTS_KEY, environments);
}

export async function setEnvironmentWabaIds(id: string, wabaIds: string[]) {
  const environment = (await allEnvironments()).find((item) => item.id === id && !item.archivedAt);
  if (!environment) throw new Error("Environment not found.");
  const normalized = [...new Set(wabaIds.map((item) => item.trim()).filter(Boolean))];
  if (normalized.some((item) => !/^\d{5,30}$/.test(item))) {
    throw new Error("WABA IDs must contain digits only.");
  }
  await getKv().set(environmentKey(id, "manual-waba-ids"), normalized);
  return normalized;
}

export async function getActiveEnvironment() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Authentication required.");
  const accessible = await listEnvironmentsForUser(email);
  const selectedId = await getActiveEnvironmentIdForUser(email);
  const selected = accessible.find((item) => item.id === selectedId);
  if (!selected) {
    throw new Error("No Vonage environment is assigned to this user.");
  }
  const environment = (await allEnvironments()).find((item) => item.id === selected.id)!;
  return {
    id: environment.id,
    name: environment.name,
    apiKey: decryptSecret(environment.apiKey),
    apiSecret: decryptSecret(environment.apiSecret),
    applicationId: decryptSecret(environment.applicationId),
    privateKey: decryptSecret(environment.privateKey),
    vcrCredentialName: decryptOptionalSecret(environment.vcrCredentialName),
  };
}

export async function setActiveEnvironment(id: string) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !(await listEnvironmentsForUser(email)).some((item) => item.id === id)) {
    throw new Error("Environment access denied.");
  }
  (await cookies()).set(ACTIVE_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
}

export function environmentKey(environmentId: string, collection: string) {
  return `waba-br:env:${environmentId}:${collection}`;
}
