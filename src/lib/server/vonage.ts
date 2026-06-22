import type { VonageTemplatePayload, Waba } from "@/lib/domain/types";

type VonageConfig = {
  apiKey: string;
  apiSecret: string;
};

function getVonageConfig(): VonageConfig {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("VONAGE_API_KEY and VONAGE_API_SECRET are required.");
  }

  return { apiKey, apiSecret };
}

function basicAuth(config: VonageConfig) {
  return Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
}

export async function fetchVonageWabas(): Promise<Waba[]> {
  const config = getVonageConfig();
  const response = await fetch("https://api.nexmo.com/v2/whatsapp-manager/wabas", {
    headers: {
      Authorization: `Basic ${basicAuth(config)}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Vonage WABA sync failed with ${response.status}.`);
  }

  const data = (await response.json()) as { wabas?: Array<Record<string, unknown>> };
  return (data.wabas ?? []).map((waba) => ({
    id: String(waba.id),
    name: String(waba.name ?? waba.id),
    status: "Connected",
    country: String(waba.country ?? "Unknown"),
    templateCount: Number(waba.template_count ?? 0),
    lastSyncAt: new Date().toISOString(),
  }));
}

export async function createVonageTemplate(wabaId: string, payload: VonageTemplatePayload) {
  const config = getVonageConfig();
  const response = await fetch(`https://api.nexmo.com/v2/whatsapp-manager/wabas/${wabaId}/templates`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(config)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Vonage template creation failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}
