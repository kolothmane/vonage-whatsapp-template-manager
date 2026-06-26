import { cookies } from "next/headers";
import { auth } from "@/auth";
import type { SupportedBrand, SupportedLanguage } from "@/lib/domain/types";
import { decryptSecret, encryptSecret } from "@/lib/server/encryption";
import { getKv } from "@/lib/server/kv";
import { isAdminEmail, normalizeEmail } from "@/lib/server/admin-access";

const ENVIRONMENTS_KEY = "waba-br:environments";
const ACTIVE_COOKIE = "waba-br-environment";
const PUIG_PROD_ENVIRONMENT_NAME = "PUIG Prod";
const PUIG_PROD_VCR_CREDENTIAL_NAME = "00D06000001ljVXEAY-CERT";

export type ManualWabaEntry = {
  id: string;
  brand?: SupportedBrand;
  country?: string;
  languagePriority?: SupportedLanguage;
};

const PUIG_PROD_WABAS: ManualWabaEntry[] = [
  { id: "1678953926458758", brand: "AD", country: "AR", languagePriority: "ES" },
  { id: "1003916905715646", brand: "AD", country: "CL", languagePriority: "ES" },
  { id: "3503212643170188", brand: "AD", country: "ES", languagePriority: "ES" },
  { id: "2194955841317353", brand: "AD", country: "MX", languagePriority: "ES" },
  { id: "1031028726120075", brand: "AD", country: "PE", languagePriority: "ES" },
  { id: "3242449469267968", brand: "AB", country: "AR", languagePriority: "ES" },
  { id: "2054077341856668", brand: "AB", country: "BR", languagePriority: "PT" },
  { id: "867975379692959", brand: "AB", country: "BR", languagePriority: "PT" },
  { id: "1522612936265738", brand: "AB", country: "BR", languagePriority: "PT" },
  { id: "1053212020613617", brand: "AB", country: "CL", languagePriority: "ES" },
  { id: "1470688718195161", brand: "AB", country: "PE", languagePriority: "ES" },
  { id: "2405423889944023", brand: "BNT", country: "AR", languagePriority: "ES" },
  { id: "1014958801086611", brand: "BNT", country: "BR", languagePriority: "PT" },
  { id: "1035185162403898", brand: "BNT", country: "BR", languagePriority: "PT" },
  { id: "1570103547880697", brand: "BNT", country: "BR", languagePriority: "PT" },
  { id: "1887882388567835", brand: "BNT", country: "CL", languagePriority: "ES" },
  { id: "1690525258821677", brand: "BNT", country: "PE", languagePriority: "ES" },
  { id: "2106561960744623", brand: "CH", country: "AR", languagePriority: "ES" },
  { id: "753299174444208", brand: "CH", country: "BE", languagePriority: "FR" },
  { id: "27079087548426443", brand: "CH", country: "BR", languagePriority: "PT" },
  { id: "1476643934259136", brand: "CH", country: "BR", languagePriority: "PT" },
  { id: "1015081364350956", brand: "CH", country: "BR", languagePriority: "PT" },
  { id: "1906419490056240", brand: "CH", country: "CL", languagePriority: "ES" },
  { id: "1047644727481146", brand: "CH", country: "ES", languagePriority: "ES" },
  { id: "2302537667221917", brand: "CH", country: "IR", languagePriority: "EN" },
  { id: "2094506464443993", brand: "CH", country: "MX", languagePriority: "ES" },
  { id: "801416046388171", brand: "CH", country: "PE", languagePriority: "ES" },
  { id: "1543715240697295", brand: "CH", country: "PT", languagePriority: "PT" },
  { id: "957669923434675", brand: "CH", country: "UK", languagePriority: "EN" },
  { id: "1504132628111948", brand: "CH", country: "UK", languagePriority: "EN" },
  { id: "4419333181677473", brand: "CH", country: "UK", languagePriority: "EN" },
  { id: "853333561150417", brand: "CH", country: "UK", languagePriority: "EN" },
  { id: "1724162331945968", brand: "CH", country: "UK", languagePriority: "EN" },
  { id: "1556229372839272", brand: "CLB", country: "IT", languagePriority: "IT" },
  { id: "1723004892204100", brand: "CLB", country: "UK", languagePriority: "EN" },
  { id: "26730696983293767", brand: "DBS", country: "IT", languagePriority: "IT" },
  { id: "2790204424516073", brand: "DBS", country: "UK", languagePriority: "EN" },
  { id: "1552845176278035", brand: "DVN", country: "IT", languagePriority: "IT" },
  { id: "1578054940614244", brand: "DVN", country: "DE", languagePriority: "DE" },
  { id: "1465009405009491", brand: "DVN", country: "UK", languagePriority: "EN" },
  { id: "996726269595361", brand: "JPG", country: "AR", languagePriority: "ES" },
  { id: "1032067630000317", brand: "JPG", country: "BE", languagePriority: "FR" },
  { id: "1651029142637195", brand: "JPG", country: "BR", languagePriority: "PT" },
  { id: "834600956194515", brand: "JPG", country: "BR", languagePriority: "PT" },
  { id: "2728831394179927", brand: "JPG", country: "BR", languagePriority: "PT" },
  { id: "1501884117783751", brand: "JPG", country: "CL", languagePriority: "ES" },
  { id: "1189574049793796", brand: "JPG", country: "ES", languagePriority: "ES" },
  { id: "1464575025357431", brand: "JPG", country: "IR", languagePriority: "EN" },
  { id: "938989768967237", brand: "JPG", country: "MX", languagePriority: "ES" },
  { id: "2484992828683686", brand: "JPG", country: "PE", languagePriority: "ES" },
  { id: "1627317049401869", brand: "JPG", country: "PT", languagePriority: "PT" },
  { id: "972741228437378", brand: "JPG", country: "UK", languagePriority: "EN" },
  { id: "864236682812287", brand: "JPG", country: "UK", languagePriority: "EN" },
  { id: "1497754431466307", brand: "KA", country: "UK", languagePriority: "EN" },
  { id: "892657003889347", brand: "LAP", country: "DE", languagePriority: "DE" },
  { id: "810247451596587", brand: "LAP", country: "ES", languagePriority: "ES" },
  { id: "1842878519592322", brand: "LAP", country: "FR", languagePriority: "FR" },
  { id: "1392861965995801", brand: "LAP", country: "IT", languagePriority: "IT" },
  { id: "1721119519247102", brand: "LAP", country: "UK", languagePriority: "EN" },
  { id: "1393000619094925", brand: "LDS", country: "MX", languagePriority: "ES" },
  { id: "1602883757484190", brand: "NR", country: "AR", languagePriority: "ES" },
  { id: "915822151533652", brand: "NR", country: "BE", languagePriority: "FR" },
  { id: "2691621974550235", brand: "NR", country: "BR", languagePriority: "PT" },
  { id: "1054124077084951", brand: "NR", country: "BR", languagePriority: "PT" },
  { id: "1480998903776057", brand: "NR", country: "BR", languagePriority: "PT" },
  { id: "794277750346439", brand: "NR", country: "CL", languagePriority: "ES" },
  { id: "1924204911842820", brand: "NR", country: "ES", languagePriority: "ES" },
  { id: "2886888371481856", brand: "NR", country: "IR", languagePriority: "EN" },
  { id: "26717947481222218", brand: "NR", country: "MX", languagePriority: "ES" },
  { id: "2261260267614745", brand: "NR", country: "PE", languagePriority: "ES" },
  { id: "997680269570971", brand: "NR", country: "PT", languagePriority: "PT" },
  { id: "922998313945731", brand: "NR", country: "UK", languagePriority: "EN" },
  { id: "1366228578716128", brand: "PEN", country: "BR", languagePriority: "PT" },
  { id: "1423967022872950", brand: "PEN", country: "CL", languagePriority: "ES" },
  { id: "1738194800702307", brand: "PEN", country: "DE", languagePriority: "DE" },
  { id: "2264414103988435", brand: "PEN", country: "ES", languagePriority: "ES" },
  { id: "701413529638253", brand: "PEN", country: "FR", languagePriority: "FR" },
  { id: "1706507846635018", brand: "PEN", country: "IT", languagePriority: "IT" },
  { id: "979732134975103", brand: "PEN", country: "MX", languagePriority: "ES" },
  { id: "1457978219433702", brand: "PEN", country: "PT", languagePriority: "PT" },
  { id: "1652195785716727", brand: "PEN", country: "UK", languagePriority: "EN" },
  { id: "1284715343640482", brand: "PR", country: "AR", languagePriority: "ES" },
  { id: "1448180803237320", brand: "PR", country: "BE", languagePriority: "FR" },
  { id: "2520735135037312", brand: "PR", country: "BR", languagePriority: "PT" },
  { id: "1310404367365308", brand: "PR", country: "BR", languagePriority: "PT" },
  { id: "1386772396833927", brand: "PR", country: "BR", languagePriority: "PT" },
  { id: "1388487819836346", brand: "PR", country: "CL", languagePriority: "ES" },
  { id: "3138137469725595", brand: "PR", country: "DE", languagePriority: "DE" },
  { id: "1731612147801065", brand: "PR", country: "ES", languagePriority: "ES" },
  { id: "1370302058290978", brand: "PR", country: "IR", languagePriority: "EN" },
  { id: "955608490812235", brand: "PR", country: "IT", languagePriority: "IT" },
  { id: "2950007448674195", brand: "PR", country: "MX", languagePriority: "ES" },
  { id: "28052680964332980", brand: "PR", country: "PE", languagePriority: "ES" },
  { id: "866827709824327", brand: "PR", country: "PT", languagePriority: "PT" },
  { id: "1676028860512639", brand: "PR", country: "UK", languagePriority: "EN" },
  { id: "964303159551898", brand: "SHA", country: "AR", languagePriority: "ES" },
  { id: "1323792062659194", brand: "SHA", country: "CL", languagePriority: "ES" },
];

function normalizeManualWabas(entries: ManualWabaEntry[]) {
  const byId = new Map<string, ManualWabaEntry>();
  for (const entry of entries) {
    const id = entry.id.trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      brand: entry.brand,
      country: entry.country?.trim().toUpperCase(),
      languagePriority: entry.languagePriority,
    });
  }
  return [...byId.values()];
}

async function setManualWabas(id: string, entries: ManualWabaEntry[]) {
  const normalized = normalizeManualWabas(entries);
  if (normalized.some((item) => !/^\d{5,30}$/.test(item.id))) {
    throw new Error("WABA IDs must contain digits only.");
  }
  await Promise.all([
    getKv().set(environmentKey(id, "manual-waba-ids"), normalized.map((entry) => entry.id)),
    getKv().set(environmentKey(id, "manual-wabas"), normalized),
  ]);
  return normalized;
}

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

  const existingPuig = environments.find((environment) => environment.name === PUIG_PROD_ENVIRONMENT_NAME && !environment.archivedAt);
  if (existingPuig) {
    if (!decryptOptionalSecret(existingPuig.vcrCredentialName)) {
      existingPuig.vcrCredentialName = encryptSecret(PUIG_PROD_VCR_CREDENTIAL_NAME);
      await getKv().set(ENVIRONMENTS_KEY, environments);
    }
    await setManualWabas(existingPuig.id, PUIG_PROD_WABAS);
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
    vcrCredentialName: encryptSecret(PUIG_PROD_VCR_CREDENTIAL_NAME),
    userEmails: admins,
    createdAt: new Date().toISOString(),
    createdBy,
  };
  const next = [...environments, environment];
  await getKv().set(ENVIRONMENTS_KEY, next);
  await setManualWabas(environment.id, PUIG_PROD_WABAS);
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
  const normalized = await setManualWabas(id, wabaIds.map((wabaId) => ({ id: wabaId })));
  return normalized.map((entry) => entry.id);
}

export async function getEnvironmentManualWabas(id: string) {
  const entries = (await getKv().get<ManualWabaEntry[]>(environmentKey(id, "manual-wabas"))) ?? [];
  if (entries.length > 0) {
    return normalizeManualWabas(entries);
  }
  const ids = (await getKv().get<string[]>(environmentKey(id, "manual-waba-ids"))) ?? [];
  return normalizeManualWabas(ids.map((wabaId) => ({ id: wabaId })));
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

export async function getEnvironmentConfigById(id: string) {
  const environment = (await allEnvironments()).find((item) => item.id === id && !item.archivedAt);
  if (!environment) throw new Error("Environment not found.");
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
