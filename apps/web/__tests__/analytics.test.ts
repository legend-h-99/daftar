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
});
