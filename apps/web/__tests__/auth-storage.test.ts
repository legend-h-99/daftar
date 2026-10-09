import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearToken, getToken, isAuthenticated, setToken } from "@/lib/auth";

beforeEach(() => {
  // Node 25 exposes a non-functional global storage without --localstorage-file.
  // Use an isolated Storage implementation; browser persistence is also tested in E2E.
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    toJSON: () => Object.fromEntries(values),
  });
  clearToken();
});
afterEach(() => { clearToken(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("browser session storage", () => {
  it("keeps local development credentials in memory only", () => {
    vi.stubEnv("NEXT_PUBLIC_SESSION_PROXY_ENABLED", "false");
    setToken("private-token");
    expect(getToken()).toBe("private-token");
    expect(window.localStorage.getItem("daftar_token")).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain("private-token");
  });
  it("stores only a non-secret navigation hint in session proxy mode", () => {
    vi.stubEnv("NEXT_PUBLIC_SESSION_PROXY_ENABLED", "true");
    setToken(undefined, true);
    expect(isAuthenticated()).toBe(true);
    expect(getToken()).toBeNull();
    expect(window.localStorage.getItem("daftar_session")).toBe("1");
    clearToken();
    expect(isAuthenticated()).toBe(false);
    expect(window.localStorage.getItem("daftar_session")).toBeNull();
  });
  it("discards tokens left by older releases instead of reusing them", () => {
    vi.stubEnv("NEXT_PUBLIC_SESSION_PROXY_ENABLED", "true");
    window.localStorage.setItem("daftar_token", "legacy-secret");
    expect(isAuthenticated()).toBe(false);
    expect(getToken()).toBeNull();
    expect(window.localStorage.getItem("daftar_token")).toBeNull();
  });
  it("does not treat an empty auth response as a successful login", () => {
    expect(() => setToken()).toThrow();
    expect(isAuthenticated()).toBe(false);
  });
});
