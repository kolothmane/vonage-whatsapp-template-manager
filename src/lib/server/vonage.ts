import { importPKCS8, SignJWT } from "jose";
import type { VonageTemplatePayload, Waba } from "@/lib/domain/types";
import { getKv, hasKvConfig } from "@/lib/server/kv";
import { ensureVonageTrailingParamMarker } from "@/lib/domain/payload";
import { environmentKey, getActiveEnvironment } from "@/lib/server/environments";


type VonageConfig = {
  apiKey?: string;
  apiSecret?: string;
  applicationId?: string;
  privateKey?: string;
};

async function getVonageConfig(): Promise<VonageConfig> {
  const environment = await getActiveEnvironment();
  return {
    apiKey: environment.apiKey,
    apiSecret: environment.apiSecret,
    applicationId: environment.applicationId,
    privateKey: environment.privateKey?.replace(/\\n/g, "\n"),
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

async function applicationAuthorizationHeader(config: VonageConfig) {
  if (!config.applicationId || !config.privateKey) {
    throw new Error(
      "VONAGE_APPLICATION_ID and VONAGE_PRIVATE_KEY are required for template management.",
    );
  }

  const key = await importPKCS8(config.privateKey, "RS256");
  const token = await new SignJWT({ application_id: config.applicationId })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime("5m")
    .sign(key);
  return `Bearer ${token}`;
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

async function fetchVonageWabaPage(authorization: string, page: number) {
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
    throw new Error(`Vonage WABA sync failed with ${response.status}.${tracking}${details}`);
  }

  const data = (await response.json()) as VonageWabaResponse;
  return {
    data,
    wabas: extractWabas(data),
    requestId: response.headers.get("x-request-id"),
  };
}

async function fetchAllVonageWabaPages(authorization: string) {
  const firstPage = await fetchVonageWabaPage(authorization, 1);
  const totalPages = Math.max(1, Number(firstPage.data.total_pages ?? 1));
  const remainingPages = await Promise.all(
    Array.from(
      { length: totalPages - 1 },
      (_, index) => fetchVonageWabaPage(authorization, index + 2),
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

async function fetchVerifiedManualWabas(config: VonageConfig): Promise<Waba[]> {
  if (!hasKvConfig()) {
    return [];
  }

  const environment = await getActiveEnvironment();
  const wabaIds =
    (await getKv().get<string[]>(environmentKey(environment.id, "manual-waba-ids"))) ?? [];
  if (wabaIds.length === 0) {
    return [];
  }

  const authorization = await applicationAuthorizationHeader(config);
  const verified: Array<Waba | null> = await Promise.all(
    wabaIds.map(async (wabaId) => {
      const response = await fetch(
        `https://api.nexmo.com/v2/whatsapp-manager/wabas/${encodeURIComponent(wabaId)}/templates?limit=1`,
        {
          headers: { Authorization: authorization, Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        return null;
      }

      return {
        id: wabaId,
        name: `WABA ${wabaId}`,
        status: "Connected" as const,
        country: "Unknown",
        templateCount: 0,
        lastSyncAt: new Date().toISOString(),
      };
    }),
  );

  return verified.filter((waba): waba is Waba => Boolean(waba));
}

export async function fetchVonageWabas(): Promise<Waba[]> {
  const config = await getVonageConfig();
  const basicResult = await fetchAllVonageWabaPages(basicAuthorizationHeader(config));
  let selectedResult = basicResult;
  let jwtTotalItems: number | null = null;

  if (basicResult.rawWabas.length === 0 && config.applicationId && config.privateKey) {
    const jwtResult = await fetchAllVonageWabaPages(
      await applicationAuthorizationHeader(config),
    );
    jwtTotalItems = jwtResult.totalItems;
    if (jwtResult.rawWabas.length > 0) {
      selectedResult = jwtResult;
    }
  }

  if (selectedResult.rawWabas.length === 0) {
    const manualWabas = await fetchVerifiedManualWabas(config);
    if (manualWabas.length > 0) {
      return manualWabas;
    }
  }

  if (selectedResult.rawWabas.length === 0) {
    const credentialLabel = `Vonage account API key ending in ${config.apiKey!.slice(-4)}`;
    const requestId = basicResult.firstPage.requestId
      ? ` Request ID: ${basicResult.firstPage.requestId}.`
      : "";
    const jwtTotal = jwtTotalItems === null ? "not attempted" : String(jwtTotalItems);
    throw new Error(
      `Vonage authenticated the request but returned no WABAs for the ${credentialLabel}. Basic total_items: ${basicResult.totalItems}. JWT total_items: ${jwtTotal}.${requestId}`,
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
    templateCount: Number(waba.template_count ?? waba.templates_count ?? 0),
    lastSyncAt: new Date().toISOString(),
  };
  });
}

export async function createVonageTemplate(wabaId: string, payload: VonageTemplatePayload) {
  const config = await getVonageConfig();
  const response = await fetch(`https://api.nexmo.com/v2/whatsapp-manager/wabas/${wabaId}/templates`, {
    method: "POST",
    headers: {
      Authorization: await applicationAuthorizationHeader(config),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Vonage template creation failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
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
  const authorization = await applicationAuthorizationHeader(config);
  let url: string | null =
    `https://api.nexmo.com/v2/whatsapp-manager/wabas/${encodeURIComponent(wabaId)}/templates?limit=500`;
  const templates: VonageExistingTemplate[] = [];

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as {
      templates?: Array<Record<string, unknown>>;
      paging?: { next?: string };
      detail?: string;
    };
    if (!response.ok) {
      throw new Error(`Vonage template list failed with ${response.status}: ${data.detail ?? "Unknown error"}`);
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
  const response = await fetch(
    `https://api.nexmo.com/v2/whatsapp-manager/wabas/${encodeURIComponent(wabaId)}/templates/${encodeURIComponent(templateId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: await applicationAuthorizationHeader(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: changes.name,
        language: changes.language,
        category: changes.category,
        components,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
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
  account: AuditCheck & {
    apiKeySuffix: string | null;
  };
  application: AuditCheck & {
    applicationId: string | null;
    belongsToAccount: boolean | null;
  };
  channelManagerBasic: AuditCheck & {
    totalItems: number | null;
  };
  channelManagerJwt: AuditCheck & {
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
  const applicationId = config.applicationId ?? null;

  let account: VonageConnectionAudit["account"] = {
    ok: false,
    status: null,
    detail: "Basic account credentials are not configured.",
    apiKeySuffix,
  };
  let application: VonageConnectionAudit["application"] = {
    ok: false,
    status: null,
    detail: "Application credentials are not configured.",
    applicationId,
    belongsToAccount: null,
  };
  let channelManagerBasic: VonageConnectionAudit["channelManagerBasic"] = {
    ok: false,
    status: null,
    detail: "Basic account credentials are not configured.",
    totalItems: null,
  };
  let channelManagerJwt: VonageConnectionAudit["channelManagerJwt"] = {
    ok: false,
    status: null,
    detail: "Application credentials are not configured.",
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

    if (applicationId) {
      const applicationResponse = await fetch(
        `https://api.nexmo.com/v2/applications/${encodeURIComponent(applicationId)}`,
        {
          headers: { Authorization: authorization, Accept: "application/json" },
          cache: "no-store",
        },
      );
      const applicationBody = await safeJson(applicationResponse);
      application = {
        ok: applicationResponse.ok,
        status: applicationResponse.status,
        detail: responseDetail(applicationResponse, applicationBody),
        requestId: applicationResponse.headers.get("x-request-id") ?? undefined,
        applicationId,
        belongsToAccount: applicationResponse.ok,
      };
    }
  }

  if (config.applicationId && config.privateKey) {
    try {
      channelManagerJwt = await auditChannelManager(
        await applicationAuthorizationHeader(config),
      );
    } catch (error) {
      channelManagerJwt = {
        ok: false,
        status: null,
        detail: error instanceof Error ? error.message : "JWT generation failed.",
        totalItems: null,
      };
    }
  }

  let conclusion =
    "The Vonage connection is valid, but no WABAs are linked to this account in Channel Manager.";
  if (!account.ok) {
    conclusion = "The account API key/secret are invalid or unavailable.";
  } else if (application.belongsToAccount === false) {
    conclusion =
      "The Application ID does not belong to the account identified by VONAGE_API_KEY.";
  } else if ((channelManagerBasic.totalItems ?? 0) > 0) {
    conclusion = "WABAs are linked to the account and can be synchronized with Basic Auth.";
  } else if ((channelManagerJwt.totalItems ?? 0) > 0) {
    conclusion =
      "WABAs are visible through the application JWT but not through the configured account credentials.";
  }

  return {
    account,
    application,
    channelManagerBasic,
    channelManagerJwt,
    conclusion,
  };
}
