import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Execute the exact deployed Worker source. No network requests are allowed.
const source = readFileSync(resolve(process.cwd(), "public/_worker.js"), "utf8")
  .replace("export default worker;", "globalThis.worker = worker;");
const token = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({ sub: "user-1", exp })).replace(/=/g, "")}.signature`;
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
});
const fetchMock = vi.fn();
const assets = vi.fn(async () => new Response("asset"));
const sandbox = { URL, Headers, Request, Response, atob, Date, fetch: fetchMock, worker: undefined as unknown };
runInNewContext(source, sandbox);
const worker = sandbox.worker as { fetch(req: Request, env: Record<string, unknown>): Promise<Response> };
const env = { ASSETS: { fetch: assets } };
function request(path: string, method = "GET", headers: Record<string, string> = {}) {
  return new Request(`https://daftar1.com${path}`, {
    method, headers: { ...(method === "GET" ? {} : { Origin: "https://daftar1.com" }), ...headers },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
}

beforeEach(() => { fetchMock.mockReset(); assets.mockClear(); });

describe("Cloudflare session boundary", () => {
  it.each(["/auth/google", "/auth/email/login", "/auth/email/verify", "/auth/password/reset", "/onboarding"])("keeps %s credentials out of JSON and sets a secure cookie", async path => {
    const issued = token();
    fetchMock.mockResolvedValue(response({ accessToken: issued, hasBusiness: true }));
    const result = await worker.fetch(request(`/api-proxy${path}`, "POST"), env);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ sessionAuthenticated: true, hasBusiness: true });
    const cookie = result.headers.get("Set-Cookie");
    for (const flag of ["__Host-daftar_session=", "HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age="]) expect(cookie).toContain(flag);
    expect(cookie).not.toContain("Domain=");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(result.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("forwards only the cookie credential and preserves query parameters", async () => {
    const credential = token();
    fetchMock.mockResolvedValue(response({ total: 10 }));
    await worker.fetch(request("/api-proxy/dashboard/summary?month=2026-10", "GET", {
      Cookie: `other=value; __Host-daftar_session=${credential}`, Authorization: "Bearer spoofed",
      "X-Forwarded-For": "spoofed-ip", "CF-Connecting-IP": "203.0.113.1",
    }), env);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://nklcbcpkycrhuumpbksb.supabase.co");
    expect(url.searchParams.get("month")).toBe("2026-10");
    expect(options.headers.get("Authorization")).toBe(`Bearer ${credential}`);
    expect(options.headers.get("X-Forwarded-For")).toBeNull();
    expect(options.headers.get("Cookie")).toBeNull();
  });

  it.each(["POST", "PATCH", "DELETE"])("rejects cross-origin %s requests before contacting the API", async method => {
    const result = await worker.fetch(request("/api-proxy/invoices", method, { Origin: "https://evil.invalid" }), env);
    expect(result.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires Origin on unsafe requests, including login", async () => {
    const req = new Request("https://daftar1.com/api-proxy/auth/google", { method: "POST" });
    expect((await worker.fetch(req, env)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects cross-site reads and ignores client bearer headers", async () => {
    expect((await worker.fetch(request("/api-proxy/auth/me", "GET", { "Sec-Fetch-Site": "cross-site" }), env)).status).toBe(403);
    fetchMock.mockResolvedValue(response({ message: "Unauthorized" }, 401));
    const result = await worker.fetch(request("/api-proxy/auth/me", "GET", { Authorization: "Bearer spoofed" }), env);
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBeNull();
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("clears expired sessions after API rejection", async () => {
    fetchMock.mockResolvedValue(response({ message: "Unauthorized" }, 401));
    const result = await worker.fetch(request("/api-proxy/dashboard/summary", "GET", { Cookie: `__Host-daftar_session=${token(1)}` }), env);
    expect(result.status).toBe(401);
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("replaces the cookie when onboarding rotates the token", async () => {
    fetchMock.mockResolvedValue(response({ accessToken: token(), business: { id: "b1" } }));
    const result = await worker.fetch(request("/api-proxy/onboarding", "POST"), env);
    expect(result.headers.get("Set-Cookie")).toContain("__Host-daftar_session=");
    expect(await result.json()).not.toHaveProperty("accessToken");
  });
  it("revokes through the API and clears the cookie on logout", async () => {
    fetchMock.mockResolvedValue(response({ success: true }));
    const result = await worker.fetch(request("/api-proxy/auth/logout", "POST", { Cookie: `__Host-daftar_session=${token()}` }), env);
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toContain("Bearer ");
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("clears the cookie even when the upstream fails during logout", async () => {
    fetchMock.mockRejectedValue(new Error("private upstream detail"));
    const result = await worker.fetch(request("/api-proxy/auth/logout", "POST"), env);
    expect(result.status).toBe(502);
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(await result.text()).not.toContain("private upstream detail");
  });
  it("does not follow redirects to another upstream", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { Location: "https://evil.invalid" } }));
    expect((await worker.fetch(request("/api-proxy/auth/me"), env)).status).toBe(502);
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual");
  });
  it("rejects an invalid configured upstream", async () => {
    expect((await worker.fetch(request("/api-proxy/auth/me"), { ...env, DAFTAR_API_URL: "https://evil.invalid" })).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed if a login returns an already expired token", async () => {
    fetchMock.mockResolvedValue(response({ accessToken: token(1) }));
    const result = await worker.fetch(request("/api-proxy/auth/google", "POST"), env);
    expect(result.status).toBe(401);
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("streams authenticated binary downloads without exposing cookies", async () => {
    fetchMock.mockResolvedValue(new Response("pdf-data", { headers: { "Content-Type": "application/pdf" } }));
    const result = await worker.fetch(request("/api-proxy/invoices/1/pdf"), env);
    expect(await result.text()).toBe("pdf-data");
    expect(result.headers.get("Cache-Control")).toBe("no-store");
  });
  it("preserves static assets and index.txt document recovery", async () => {
    expect(await (await worker.fetch(request("/icon"), env)).text()).toBe("asset");
    const result = await worker.fetch(request("/reports/index.txt?_rsc=old", "GET", { Accept: "text/html" }), env);
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe("https://daftar1.com/reports/");
  });
});
