import type { VonageTemplatePayload, Waba } from "@/lib/domain/types";
import { getKv, hasKvConfig } from "@/lib/server/kv";
import { ensureVonageTrailingParamMarker } from "@/lib/domain/payload";
import { environmentKey, getActiveEnvironment, getEnvironmentManualWabas } from "@/lib/server/environments";


export type VonageConfig = {
  environmentId?: string;
  apiKey?: string;
  apiSecret?: string;
  applicationId?: string;
  privateKey?: string;
  vcrCredentialName?: string;
  environmentName?: string;
};

const VCR_TOKEN_REFRESH_AFTER_SECONDS = 115 * 60;
const VCR_TOKEN_EXPIRY_SAFETY_SECONDS = 5 * 60;

async function getVonageConfig(): Promise<VonageConfig> {
  const environment = await getActiveEnvironment();
  const envBackedVcrCredential =
    environment.apiKey === process.env.VONAGE_API_KEY
      ? process.env.VONAGE_VCR_CREDENTIAL_NAME ?? process.env.VCR_CREDENTIAL_NAME
      : undefined;
  return {
    environmentId: environment.id,
    apiKey: environment.apiKey,
    apiSecret: environment.apiSecret,
    applicationId: environment.applicationId,
    privateKey: environment.privateKey?.replace(/\\n/g, "\n"),
    vcrCredentialName: environment.vcrCredentialName || envBackedVcrCredential,
    environmentName: environment.name,
  };
}

function basicAuth(config: VonageConfig) {
  return Buffer.from(`${config.apiKey!}:${config.apiSecret!}`).toString("base64");
}

function basicAuthorizationHeader(config: VonageConfig) {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error("VONAGE_API_KEY and VONAGE_API_SECRET are required for Channel Manager.");
  }

  return `Basic ${basicAuth(config)}`;
}

function normalizeVcrCredentialName(value: string) {
  const trimmed = value.trim();
  return trimmed.endsWith("-CERT") ? trimmed : `${trimmed}-CERT`;
}

function extractVcrToken(body: Record<string, unknown>) {
  for (const key of ["token", "access_token", "jwt"]) {
    if (typeof body[key] === "string") return String(body[key]);
  }
  if (typeof body.body === "string") return body.body;
  if (body.body && typeof body.body === "object") {
    const nested = body.body as Record<string, unknown>;
    for (const key of ["token", "access_token", "jwt"]) {
      if (typeof nested[key] === "string") return String(nested[key]);
    }
  }
  return "";
}

function vcrTokenCacheKey(config: VonageConfig, credentialName: string) {
  return config.environmentId
    ? environmentKey(config.environmentId, `vcr-token:${credentialName}`)
    : "";
}

async function clearCachedVcrToken(config: VonageConfig) {
  if (!config.vcrCredentialName || !hasKvConfig()) return;
  const credentialName = normalizeVcrCredentialName(config.vcrCredentialName);
  const cacheKey = vcrTokenCacheKey(config, credentialName);
  if (cacheKey) {
    await getKv().del(cacheKey);
  }
}

function isInvalidTokenResponse(response: Response, body: unknown) {
  if (response.status !== 401) return false;
  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  return /invalid token/i.test(serialized);
}

async function vcrAuthorizationHeader(config: VonageConfig, options?: { forceRefresh?: boolean }) {
  if (!config.apiKey || !config.apiSecret || !config.vcrCredentialName) {
    throw new Error(
      "API key, API secret and VCR credential name are required for template management.",
    );
  }

  const credentialName = normalizeVcrCredentialName(config.vcrCredentialName);
  const cacheKey = vcrTokenCacheKey(config, credentialName);
  if (!options?.forceRefresh && cacheKey && hasKvConfig()) {
    const cached = await getKv().get<{ token: string; expiresAt: string }>(cacheKey);
    if (cached?.token && Date.parse(cached.expiresAt) > Date.now()) {
      return `Bearer ${cached.token}`;
    }
  }

  const response = await fetch(
    `https://api-eu.vonage.com/v1/creds/${encodeURIComponent(credentialName)}/token`,
    {
      headers: {
        Accept: "application/json",
        Authorization: basicAuthorizationHeader(config),
      },
      cache: "no-store",
    },
  );
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      `Vonage VCR token retrieval failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  const token = extractVcrToken(body);
  if (!token) {
    throw new Error(
      `Vonage VCR token response did not include a usable token. Response keys: ${Object.keys(body).join(", ") || "none"}.`,
    );
  }
  const ttlSeconds = Number(body.ttl ?? 7200);
  const usableTtlSeconds = Math.max(
    60,
    Math.min(ttlSeconds - VCR_TOKEN_EXPIRY_SAFETY_SECONDS, VCR_TOKEN_REFRESH_AFTER_SECONDS),
  );
  if (cacheKey && hasKvConfig()) {
    await getKv().set(cacheKey, {
      token,
      expiresAt: new Date(Date.now() + usableTtlSeconds * 1000).toISOString(),
    });
  }
  return `Bearer ${token}`;
}

async function fetchWithVcrAuthorization(
  config: VonageConfig,
  input: string | URL,
  init: RequestInit = {},
) {
  let authorization = await vcrAuthorizationHeader(config);
  const headers = new Headers(init.headers);
  headers.set("Authorization", authorization);
  let response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });

  const cloned = response.clone();
  const body = await cloned.json().catch(async () => cloned.text().catch(() => ""));
  if (!isInvalidTokenResponse(response, body)) {
    return { response, body };
  }

  await clearCachedVcrToken(config);
  authorization = await vcrAuthorizationHeader(config, { forceRefresh: true });
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", authorization);
  response = await fetch(input, {
    ...init,
    headers: retryHeaders,
    cache: "no-store",
  });
  const retryClone = response.clone();
  return {
    response,
    body: await retryClone.json().catch(async () => retryClone.text().catch(() => "")),
  };
}

type VonageWabaResponse = {
  wabas?: Array<Record<string, unknown>>;
  items?: Array<Record<string, unknown>>;
  _embedded?: Record<string, unknown>;
  page?: number;
  page_number?: number;
  total_pages?: number;
};

function extractWabas(data: VonageWabaResponse) {
  if (Array.isArray(data.wabas)) {
    return data.wabas;
  }
  if (Array.isArray(data.items)) {
    return data.items;
  }

  const embedded = data._embedded;
  if (embedded) {
    for (const key of ["wabas", "whatsapp_business_accounts", "items"]) {
      if (Array.isArray(embedded[key])) {
        return embedded[key] as Array<Record<string, unknown>>;
      }
    }
  }

  const topLevelKeys = Object.keys(data).join(", ") || "none";
  const embeddedKeys = embedded ? Object.keys(embedded).join(", ") || "none" : "none";
  throw new Error(
    `Vonage returned an unsupported WABA response shape. Top-level keys: ${topLevelKeys}. Embedded keys: ${embeddedKeys}.`,
  );
}

async function fetchVonageWabaPage(authorization: string, page: number, credentialLabel: string) {
  const url = new URL("https://api.nexmo.com/v1/channel-manager/whatsapp/wabas");
  url.searchParams.set("page_size", "100");
  url.searchParams.set("page", String(page));
  const response = await fetch(url, {
    headers: {
      Authorization: authorization,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    const requestId = response.headers.get("x-request-id");
    const details = body ? ` ${body}` : "";
    const tracking = requestId ? ` Request ID: ${requestId}.` : "";
    throw new Error(`Vonage WABA sync failed with ${response.status} for ${credentialLabel}.${tracking}${details}`);
  }

  const data = (await response.json()) as VonageWabaResponse;
  return {
    data,
    wabas: extractWabas(data),
    requestId: response.headers.get("x-request-id"),
  };
}

async function fetchAllVonageWabaPages(authorization: string, credentialLabel: string) {
  const firstPage = await fetchVonageWabaPage(authorization, 1, credentialLabel);
  const totalPages = Math.max(1, Number(firstPage.data.total_pages ?? 1));
  const remainingPages = await Promise.all(
    Array.from(
      { length: totalPages - 1 },
      (_, index) => fetchVonageWabaPage(authorization, index + 2, credentialLabel),
    ),
  );

  return {
    firstPage,
    rawWabas: [
      ...firstPage.wabas,
      ...remainingPages.flatMap((result) => result.wabas),
    ],
    totalItems: Number(
      (firstPage.data as VonageWabaResponse & { total_items?: number }).total_items ??
        firstPage.wabas.length,
    ),
  };
}

type VonageWabaNumber = {
  waba_id?: string;
  api_key?: string;
  verified_name?: string;
};

function extractWabaNumbers(data: Record<string, unknown>) {
  const embedded = data._embedded as Record<string, unknown> | undefined;
  for (const key of ["numbers", "wabas", "items"]) {
    if (Array.isArray(embedded?.[key])) {
      return embedded[key] as VonageWabaNumber[];
    }
  }
  return [];
}

async function fetchWabaNumbers(wabaId: string, authorizations: string[]) {
  for (const authorization of authorizations) {
    const response = await fetch(
      `https://api.nexmo.com/v1/channel-manager/whatsapp/wabas/${encodeURIComponent(wabaId)}/numbers?page=1&page_size=100`,
      {
        headers: { Authorization: authorization, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (response.ok) {
      return extractWabaNumbers(await response.json() as Record<string, unknown>);
    }
  }
  return [];
}

async function fetchManualWabaDetails(wabaId: string, authorizations: string[]) {
  for (const authorization of authorizations) {
    const response = await fetch(
      `https://api.nexmo.com/v1/channel-manager/whatsapp/wabas/${encodeURIComponent(wabaId)}`,
      {
        headers: { Authorization: authorization, Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (response.ok) {
      return await response.json() as Record<string, unknown>;
    }
  }
  return null;
}

async function fetchTemplateCount(wabaId: string, authorizations: string[]) {
  for (const authorization of authorizations) {
    let url: string | null =
      `https://api.nexmo.com/v2/whatsapp-manager/wabas/${encodeURIComponent(wabaId)}/templates?limit=500`;
    let count = 0;
    let succeeded = false;
    while (url) {
      const response = await fetch(url, {
        headers: { Authorization: authorization, Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) break;
      succeeded = true;
      const data = await response.json() as {
        templates?: unknown[];
        paging?: { next?: string };
      };
      count += data.templates?.length ?? 0;
      url = data.paging?.next ?? null;
    }
    if (succeeded) return count;
  }
  return null;
}

function manualWabaName(brand: string | undefined, country: string | undefined, wabaId: string) {
  return [brand, country].filter(Boolean).join(" ") || `WABA ${wabaId}`;
}

async function fetchVerifiedManualWabas(config: VonageConfig): Promise<Waba[]> {
  if (!hasKvConfig()) {
    return [];
  }

  const environment = await getActiveEnvironment();
  const manualWabas = await getEnvironmentManualWabas(environment.id);
  if (manualWabas.length === 0) {
    return [];
  }

  const basicAuthorization = basicAuthorizationHeader(config);
  let vcrAuthorization: string | null = null;
  if (config.vcrCredentialName) {
    try {
      vcrAuthorization = await vcrAuthorizationHeader(config);
    } catch {
      vcrAuthorization = null;
    }
  }
  const channelAuthorizations = [
    basicAuthorization,
    ...(vcrAuthorization ? [vcrAuthorization] : []),
  ];
  const templateAuthorizations = [
    ...(vcrAuthorization ? [vcrAuthorization] : []),
    basicAuthorization,
  ];
  const verified: Array<Waba | null> = await Promise.all(
    manualWabas.map(async (manualWaba) => {
      const wabaId = manualWaba.id;
      const [details, numbers, templateCount] = await Promise.all([
        fetchManualWabaDetails(wabaId, channelAuthorizations),
        fetchWabaNumbers(wabaId, channelAuthorizations),
        fetchTemplateCount(wabaId, templateAuthorizations),
      ]);
      if (!details && numbers.length === 0 && templateCount === null) {
        return null;
      }
      const matchingNumbers = numbers.filter((number) =>
        String(number.waba_id ?? wabaId) === wabaId &&
        (!number.api_key || number.api_key === config.apiKey),
      );
      if (numbers.length > 0 && matchingNumbers.length === 0) {
        return null;
      }
      return {
        id: wabaId,
        name: String(
          details?.name ??
          details?.business_name ??
          manualWabaName(manualWaba.brand, manualWaba.country, wabaId)
        ),
        status:
          !details ||
          details.status === "ACTIVE" ||
          details.status === "CONNECTED" ||
          details.account_review_status === "Approved"
            ? "Connected" as const
            : "Action Required" as const,
        country: String(details?.country ?? manualWaba.country ?? "Unknown"),
        brand: manualWaba.brand,
        languagePriority: manualWaba.languagePriority,
        templateCount: Number(
          details?.template_count ??
          details?.templates_count ??
          templateCount ??
          0
        ),
        lastSyncAt: new Date().toISOString(),
      };
    }),
  );

  return verified.filter((waba): waba is Waba => Boolean(waba));
}

export async function fetchVonageWabas(): Promise<Waba[]> {
  const config = await getVonageConfig();
  const credentialLabel = `"${config.environmentName ?? "Unknown environment"}" using API key ending in ${config.apiKey?.slice(-4) ?? "n/a"}`;
  let basicResult: Awaited<ReturnType<typeof fetchAllVonageWabaPages>> | null = null;
  try {
    basicResult = await fetchAllVonageWabaPages(
      basicAuthorizationHeader(config),
      credentialLabel,
    );
  } catch (error) {
    const manualWabas = await fetchVerifiedManualWabas(config);
    if (manualWabas.length > 0) {
      return manualWabas;
    }
    throw error;
  }
  const selectedResult = basicResult;

  if (selectedResult.rawWabas.length === 0) {
    const manualWabas = await fetchVerifiedManualWabas(config);
    if (manualWabas.length > 0) {
      return manualWabas;
    }
  }

  if (selectedResult.rawWabas.length === 0) {
    const accountLabel = `Vonage account API key ending in ${config.apiKey!.slice(-4)}`;
    const requestId = basicResult?.firstPage.requestId
      ? ` Request ID: ${basicResult.firstPage.requestId}.`
      : "";
    throw new Error(
      `Vonage authenticated the request but returned no WABAs for the ${accountLabel}. Basic total_items: ${basicResult?.totalItems ?? 0}.${requestId}`,
    );
  }

  return selectedResult.rawWabas.map((waba) => {
    const id = waba.waba_id ?? waba.id;
    if (!id) {
      throw new Error(`Vonage returned a WABA without waba_id or id.`);
    }

    return {
    id: String(id),
    name: String(waba.name ?? waba.business_name ?? id),
    status:
      waba.status === "ACTIVE" || waba.account_review_status === "Approved"
        ? "Connected"
        : "Action Required",
    country: String(waba.country ?? "Unknown"),
    brand: typeof waba.brand === "string" ? waba.brand as Waba["brand"] : undefined,
    languagePriority: typeof waba.languagePriority === "string" ? waba.languagePriority as Waba["languagePriority"] : undefined,
    templateCount: Number(waba.template_count ?? waba.templates_count ?? 0),
    lastSyncAt: new Date().toISOString(),
  };
  });
}

export async function createVonageTemplateForConfig(config: VonageConfig, wabaId: string, payload: VonageTemplatePayload) {
  const { response, body } = await fetchWithVcrAuthorization(config, `https://api.nexmo.com/v2/whatsapp-manager/wabas/${wabaId}/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Vonage template creation failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

export async function createVonageTemplate(wabaId: string, payload: VonageTemplatePayload) {
  return createVonageTemplateForConfig(await getVonageConfig(), wabaId, payload);
}

export type VonageExistingTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  body: string;
  components: Array<Record<string, unknown>>;
};

export async function listVonageTemplates(wabaId: string): Promise<VonageExistingTemplate[]> {
  const config = await getVonageConfig();
  let url: string | null =
    `https://api.nexmo.com/v2/whatsapp-manager/wabas/${encodeURIComponent(wabaId)}/templates?limit=500`;
  const templates: VonageExistingTemplate[] = [];

  while (url) {
    const { response, body } = await fetchWithVcrAuthorization(config, url, {
      headers: { Accept: "application/json" },
    });
    const data = (typeof body === "object" && body ? body : {}) as {
      templates?: Array<Record<string, unknown>>;
      paging?: { next?: string };
      detail?: string;
      title?: string;
      message?: string;
    };
    if (!response.ok) {
      throw new Error(
        `Vonage template list failed with ${response.status}: ${data.detail ?? data.message ?? data.title ?? "Unknown error"}`,
      );
    }

    for (const template of data.templates ?? []) {
      const components = Array.isArray(template.components)
        ? template.components as Array<Record<string, unknown>>
        : [];
      const bodyComponent = components.find((component) => component.type === "BODY");
      templates.push({
        id: String(template.id),
        name: String(template.name ?? ""),
        language: String(template.language ?? ""),
        category: String(template.category ?? ""),
        status: String(template.status ?? "UNKNOWN"),
        body: String(bodyComponent?.text ?? ""),
        components,
      });
    }
    url = data.paging?.next ?? null;
  }

  return templates;
}

export async function updateVonageTemplate(
  wabaId: string,
  templateId: string,
  changes: { name: string; language: string; category: string; body: string; components: Array<Record<string, unknown>> },
) {
  const config = await getVonageConfig();
  const components = changes.components.map((component) =>
    component.type === "BODY"
      ? { ...component, text: ensureVonageTrailingParamMarker(changes.body) }
      : component,
  );
  const { response, body } = await fetchWithVcrAuthorization(
    config,
    `https://api.nexmo.com/v2/whatsapp-manager/wabas/${encodeURIComponent(wabaId)}/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: changes.name,
        language: changes.language,
        category: changes.category,
        components,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Vonage template update failed with ${response.status}: ${JSON.stringify(body)}`);
  }
}

type AuditCheck = {
  ok: boolean;
  status: number | null;
  detail: string;
  requestId?: string;
};

export type VonageConnectionAudit = {
  environment: {
    name: string | null;
    apiKeySuffix: string | null;
    apiKeyConfigured: boolean;
    apiSecretConfigured: boolean;
    vcrCredentialConfigured: boolean;
  };
  account: AuditCheck & {
    apiKeySuffix: string | null;
  };
  vcrToken: AuditCheck;
  channelManagerBasic: AuditCheck & {
    totalItems: number | null;
  };
  channelManagerVcrToken: AuditCheck & {
    totalItems: number | null;
  };
  conclusion: string;
};

async function safeJson(response: Response) {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function responseDetail(response: Response, body: Record<string, unknown>) {
  return String(body.detail ?? body.title ?? (response.ok ? "Request succeeded." : "Request failed."));
}

async function auditChannelManager(
  authorization: string,
): Promise<AuditCheck & { totalItems: number | null }> {
  const response = await fetch(
    "https://api.nexmo.com/v1/channel-manager/whatsapp/wabas?page=1&page_size=1",
    {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
    },
  );
  const body = await safeJson(response);
  return {
    ok: response.ok,
    status: response.status,
    detail: responseDetail(response, body),
    requestId: response.headers.get("x-request-id") ?? undefined,
    totalItems: response.ok ? Number(body.total_items ?? 0) : null,
  };
}

export async function auditVonageConnection(): Promise<VonageConnectionAudit> {
  const config = await getVonageConfig();
  const apiKeySuffix = config.apiKey?.slice(-4) ?? null;
  const environment = {
    name: config.environmentName ?? null,
    apiKeySuffix,
    apiKeyConfigured: Boolean(config.apiKey),
    apiSecretConfigured: Boolean(config.apiSecret),
    vcrCredentialConfigured: Boolean(config.vcrCredentialName),
  };

  let account: VonageConnectionAudit["account"] = {
    ok: false,
    status: null,
    detail: "Basic account credentials are not configured.",
    apiKeySuffix,
  };
  let vcrToken: VonageConnectionAudit["vcrToken"] = {
    ok: false,
    status: null,
    detail: "VCR credential name is not configured.",
  };
  let channelManagerBasic: VonageConnectionAudit["channelManagerBasic"] = {
    ok: false,
    status: null,
    detail: "Basic account credentials are not configured.",
    totalItems: null,
  };
  let channelManagerVcrToken: VonageConnectionAudit["channelManagerVcrToken"] = {
    ok: false,
    status: null,
    detail: "VCR credential name is not configured.",
    totalItems: null,
  };

  if (config.apiKey && config.apiSecret) {
    const authorization = basicAuthorizationHeader(config);
    const balanceResponse = await fetch("https://rest.nexmo.com/account/get-balance", {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
    });
    const balanceBody = await safeJson(balanceResponse);
    account = {
      ok: balanceResponse.ok,
      status: balanceResponse.status,
      detail: responseDetail(balanceResponse, balanceBody),
      requestId: balanceResponse.headers.get("x-request-id") ?? undefined,
      apiKeySuffix,
    };
    channelManagerBasic = await auditChannelManager(authorization);

  }

  if (config.vcrCredentialName) {
    try {
      const authorization = await vcrAuthorizationHeader(config);
      vcrToken = { ok: true, status: 200, detail: "VCR token retrieved." };
      channelManagerVcrToken = await auditChannelManager(authorization);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "VCR token retrieval failed.";
      vcrToken = { ok: false, status: null, detail };
      channelManagerVcrToken = {
        ok: false,
        status: null,
        detail,
        totalItems: null,
      };
    }
  }

  let conclusion =
    "The Vonage connection is valid, but no WABAs are linked to this account in Channel Manager.";
  if (!account.ok) {
    conclusion = `Vonage rejected the account credentials for ${environment.name ?? "the active environment"}. Check that the API key ending in ${apiKeySuffix ?? "n/a"} and its matching API secret are from the same Vonage account.`;
  } else if ((channelManagerBasic.totalItems ?? 0) > 0) {
    conclusion = "WABAs are linked to the account and can be synchronized with Basic Auth.";
  } else if ((channelManagerVcrToken.totalItems ?? 0) > 0) {
    conclusion =
      "WABAs are visible through the VCR token but not through the configured account credentials.";
  }

  return {
    environment,
    account,
    vcrToken,
    channelManagerBasic,
    channelManagerVcrToken,
    conclusion,
  };
}
