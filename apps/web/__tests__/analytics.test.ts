import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function load(key?: string) {
  vi.resetModules();
  if (key) vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key);
  else vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  return import("@/lib/analytics");
}

describe("analytics", () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const session = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => void session.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends nothing without a key", async () => {
    const { track } = await load();
    track("landing_viewed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an anonymous event when a key is set", async () => {
    const { track } = await load("phc_test");
    track("invoice_created", { items_count: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.event).toBe("invoice_created");
    expect(body.properties.items_count).toBe(2);
    expect(body.properties.$process_person_profile).toBe(false);
    expect(body.distinct_id).toMatch(/[0-9a-f-]{36}/);
  });

  it("respects the opt-out", async () => {
    const { track, setAnalyticsOptOut, isAnalyticsOptedOut } = await load("phc_test");
    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
    track("expense_added", { category: "INGREDIENTS" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes dynamic path segments so ids are never sent", async () => {
    const { normalizePath } = await load("phc_test");
    expect(normalizePath("/invoices/clx9k2m4p0000abcd1234efgh")).toBe("/invoices/:id");
    expect(normalizePath("/invoices/3f2b8c1e-9d4a-4e7b-8c1d-0a1b2c3d4e5f")).toBe("/invoices/:id");
    expect(normalizePath("/invoices/42/edit")).toBe("/invoices/:id/edit");
    expect(normalizePath("/invoices/list")).toBe("/invoices/list");
    expect(normalizePath("/")).toBe("/");
  });

  it("sends session_started once per browser session", async () => {
    const { trackSessionStarted } = await load("phc_test");
    trackSessionStarted();
    trackSessionStarted();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.event).toBe("session_started");
    expect(body.properties.days_since_last).toBe(-1);
  });

  it("opting out forgets the device id", async () => {
    const { track, setAnalyticsOptOut } = await load("phc_test");
    track("landing_viewed");
    expect(window.localStorage.getItem("daftar_aid")).not.toBeNull();
    setAnalyticsOptOut(true);
    expect(window.localStorage.getItem("daftar_aid")).toBeNull();
  });

  it("leaves real route words and 32-char hex ids correctly classified", async () => {
    const { normalizePath } = await load("phc_test");
    expect(normalizePath("/products/edit/view")).toBe("/products/edit/view");
    expect(normalizePath("/forgot-password")).toBe("/forgot-password");
    expect(normalizePath("/invoices/3f2b8c1e9d4a4e7b8c1d0a1b2c3d4e5f")).toBe("/invoices/:id");
  });

  it("sends the normalized path in the payload", async () => {
    const { track } = await load("phc_test");
    window.history.pushState({}, "", "/invoices/clx9k2m4p0000abcd1234efgh");
    track("landing_viewed");
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.properties.path).toBe("/invoices/:id");
    window.history.pushState({}, "", "/");
  });

  it("stops sending after opt-out", async () => {
    const { track, setAnalyticsOptOut } = await load("phc_test");
    track("landing_viewed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    setAnalyticsOptOut(true);
    track("landing_viewed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still sends session_started once when sessionStorage is blocked", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const { trackSessionStarted } = await load("phc_test");
    trackSessionStarted();
    trackSessionStarted();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
