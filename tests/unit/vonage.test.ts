import { afterEach, describe, expect, it, vi } from "vitest";
import { auditVonageConnection, fetchVonageWabas } from "@/lib/server/vonage";

const mocks = vi.hoisted(() => ({
  hasKvConfig: vi.fn(() => false),
  kvGet: vi.fn(),
}));

vi.mock("jose", () => ({
  importPKCS8: vi.fn().mockResolvedValue("test-key"),
  SignJWT: class {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setJti() { return this; }
    setExpirationTime() { return this; }
    sign() { return Promise.resolve("test-jwt"); }
  },
}));

vi.mock("@/lib/server/kv", () => ({
  hasKvConfig: mocks.hasKvConfig,
  getKv: vi.fn(() => ({ get: mocks.kvGet })),
}));

vi.mock("@/lib/server/environments", () => ({
  getActiveEnvironment: vi.fn(async () => ({
    id: "test-environment",
    name: "Test",
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET,
    applicationId: process.env.VONAGE_APPLICATION_ID,
    privateKey: process.env.VONAGE_PRIVATE_KEY,
  })),
  environmentKey: vi.fn((environmentId: string, collection: string) => `waba-br:env:${environmentId}:${collection}`),
}));

describe("fetchVonageWabas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.hasKvConfig.mockReturnValue(false);
    mocks.kvGet.mockReset();
    delete process.env.VONAGE_APPLICATION_ID;
    delete process.env.VONAGE_PRIVATE_KEY;
  });

  it("uses the Channel Manager response shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            _embedded: {
              wabas: [
                {
                  waba_id: "123",
                  name: "Bay Retail",
                  status: "ACTIVE",
                  country: "FR",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    process.env.VONAGE_API_KEY = "key";
    process.env.VONAGE_API_SECRET = "secret";

    await expect(fetchVonageWabas()).resolves.toEqual([
      {
        id: "123",
        name: "Bay Retail",
        status: "Connected",
        country: "FR",
        templateCount: 0,
        lastSyncAt: expect.any(String),
      },
    ]);

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "https://api.nexmo.com/v1/channel-manager/whatsapp/wabas?page_size=100&page=1",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Basic a2V5OnNlY3JldA==",
        }),
      }),
    );
  });

  it("does not silently convert an unknown response shape into zero WABAs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ unexpected: [] }), { status: 200 }),
      ),
    );

    process.env.VONAGE_API_KEY = "key";
    process.env.VONAGE_API_SECRET = "secret";

    await expect(fetchVonageWabas()).rejects.toThrow(
      "unsupported WABA response shape",
    );
  });

  it("reports the effective API key when Vonage returns an empty account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            total_items: 0,
            total_pages: 1,
            _embedded: { wabas: [] },
          }),
          { status: 200, headers: { "x-request-id": "request-123" } },
        ),
      ),
    );

    process.env.VONAGE_API_KEY = "account-key-9876";
    process.env.VONAGE_API_SECRET = "secret";

    await expect(fetchVonageWabas()).rejects.toThrow(
      "Basic total_items: 0. JWT total_items: not attempted. Request ID: request-123",
    );
  });

  it("retries with JWT when Basic Auth returns zero WABAs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total_items: 0,
            total_pages: 1,
            _embedded: { wabas: [] },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total_items: 1,
            total_pages: 1,
            _embedded: {
              wabas: [{ waba_id: "jwt-waba", name: "JWT WABA", status: "ACTIVE" }],
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    process.env.VONAGE_API_KEY = "key";
    process.env.VONAGE_API_SECRET = "secret";
    process.env.VONAGE_APPLICATION_ID = "application-id";
    process.env.VONAGE_PRIVATE_KEY = "private-key";

    await expect(fetchVonageWabas()).resolves.toEqual([
      expect.objectContaining({ id: "jwt-waba", name: "JWT WABA" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toMatch(/^Basic /);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer test-jwt");
  });

  it("reports Basic and JWT totals when both return zero WABAs", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              total_items: 0,
              total_pages: 1,
              _embedded: { wabas: [] },
            }),
            { status: 200 },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              total_items: 0,
              total_pages: 1,
              _embedded: { wabas: [] },
            }),
            { status: 200 },
          ),
        ),
    );

    process.env.VONAGE_API_KEY = "key";
    process.env.VONAGE_API_SECRET = "secret";
    process.env.VONAGE_APPLICATION_ID = "application-id";
    process.env.VONAGE_PRIVATE_KEY = "private-key";

    await expect(fetchVonageWabas()).rejects.toThrow(
      "Basic total_items: 0. JWT total_items: 0.",
    );
  });

  it("recovers manually registered WABAs from numbers when the parent index is inconsistent", async () => {
    mocks.hasKvConfig.mockReturnValue(true);
    mocks.kvGet.mockResolvedValue(["110326855406164"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes("/templates")) {
          return new Response(
            JSON.stringify({ templates: Array.from({ length: 45 }, (_, index) => ({ id: index })) }),
            { status: 200 },
          );
        }
        if (url.includes("/110326855406164/numbers")) {
          return new Response(
            JSON.stringify({
              total_items: 3,
              _embedded: {
                numbers: [
                  { waba_id: "110326855406164", api_key: "account-key-7877", verified_name: "Bayretail Lab UAT" },
                  { waba_id: "110326855406164", api_key: "account-key-7877", verified_name: "Bayretail Lab Test" },
                  { waba_id: "110326855406164", api_key: "account-key-7877", verified_name: "Bayretail Lab Test 2" },
                ],
              },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith("/110326855406164")) {
          return new Response(JSON.stringify({ detail: "Waba was not found" }), { status: 404 });
        }
        return new Response(
          JSON.stringify({ total_items: 0, total_pages: 1, _embedded: { wabas: [] } }),
          { status: 200 },
        );
      }),
    );

    process.env.VONAGE_API_KEY = "account-key-7877";
    process.env.VONAGE_API_SECRET = "secret";
    process.env.VONAGE_APPLICATION_ID = "application-id";
    process.env.VONAGE_PRIVATE_KEY = "private-key";

    await expect(fetchVonageWabas()).resolves.toEqual([
      {
        id: "110326855406164",
        name: "Bayretail Lab",
        status: "Connected",
        country: "Unknown",
        templateCount: 45,
        lastSyncAt: expect.any(String),
      },
    ]);
  });

  it("audits account authentication separately from application authentication", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: 10 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              total_items: 0,
              _embedded: { wabas: [] },
            }),
            { status: 200 },
          ),
        ),
    );

    process.env.VONAGE_API_KEY = "account-key-9876";
    process.env.VONAGE_API_SECRET = "secret";
    delete process.env.VONAGE_APPLICATION_ID;
    delete process.env.VONAGE_PRIVATE_KEY;

    const audit = await auditVonageConnection();
    expect(audit.account.ok).toBe(true);
    expect(audit.channelManagerBasic.totalItems).toBe(0);
    expect(audit.application.belongsToAccount).toBeNull();
    expect(audit.conclusion).toContain("no WABAs are linked to this account");
  });
});
