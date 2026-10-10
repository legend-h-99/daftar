import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
describe("anonymous first-party behavior analytics", () => {
  beforeEach(() => {
    vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    for (const key of ["localStorage", "sessionStorage"]) {
      const values = new Map<string,string>();
      vi.stubGlobal(key, { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key,value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() });
    }
    history.replaceState({}, "", "/login?utm_source=x&email=private@example.invalid");
    Object.defineProperty(navigator, "doNotTrack", { value: "0", configurable: true });
    Object.defineProperty(navigator, "globalPrivacyControl", { value: false, configurable: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("keeps anonymous IDs stable, omits credentials and never sends URLs or free text", async () => {
    const { track } = await import("@/lib/analytics");
    track("login_started", { method: "google", email: "private@example.invalid", amount: 999, workflow: "private text" });
    track("user_signed_in", { method: "google" });
    const calls = vi.mocked(fetch).mock.calls;
    const first = JSON.parse(calls[0][1]!.body as string), second = JSON.parse(calls[1][1]!.body as string);
    expect(calls[0][0]).toBe("/api-proxy/analytics/events"); expect(calls[0][1]!.credentials).toBe("omit");
    expect(first.deviceId).toBe(second.deviceId); expect(first.sessionId).toBe(second.sessionId); expect(first.id).not.toBe(second.id);
    expect(first.path).toBe("/login"); expect(first.source).toBe("x"); expect(first.properties).toEqual({ method: "google" });
    expect(JSON.stringify(first)).not.toContain("private"); expect(first.properties).not.toHaveProperty("amount");
  });
  it("stops sending and clears measurement IDs when opted out", async () => {
    const { track, setAnalyticsOptOut } = await import("@/lib/analytics");
    track("page_viewed"); setAnalyticsOptOut(true); track("expense_added");
    expect(fetch).toHaveBeenCalledTimes(1); expect(localStorage.getItem("daftar_aid")).toBeNull(); expect(sessionStorage.getItem("daftar_analytics_session")).toBeNull();
  });
  it.each(["doNotTrack", "globalPrivacyControl"])("honors browser privacy signal %s", async key => {
    Object.defineProperty(navigator, key, { value: key === "doNotTrack" ? "1" : true, configurable: true });
    const { track } = await import("@/lib/analytics"); track("page_viewed"); expect(fetch).not.toHaveBeenCalled();
  });
  it("counts repeated mounts once per page and customer session", async () => {
    const { trackPage, trackSessionStarted } = await import("@/lib/analytics");
    trackPage("/login"); trackPage("/login"); trackSessionStarted(); trackSessionStarted();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("never sends admin or record-specific paths", async () => {
    const { track } = await import("@/lib/analytics"); history.replaceState({}, "", "/admin"); track("page_viewed");
    history.replaceState({}, "", "/products/customer-private-id/edit"); track("page_viewed"); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not break the customer workflow when transport fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline")); const { track } = await import("@/lib/analytics");
    expect(() => track("invoice_created")).not.toThrow(); await Promise.resolve();
  });
});
