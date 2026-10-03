// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// Load the same unbundled module Cloudflare deploys, without changing allowJs.
const source = readFileSync(new URL("../public/_worker.js", import.meta.url), "utf8");
const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default;

describe("static export deployment navigation", () => {
  it.each(["GET", "HEAD"])("recovers a stale %s document navigation and preserves invoice parameters", async (method) => {
    const assets = { fetch: vi.fn() };
    const response = await worker.fetch(new Request("https://daftar1.com/invoices/detail/view/index.txt?id=invoice-1&_rsc=old", {
      method, headers: { Accept: "text/html,application/xhtml+xml", "Sec-Fetch-Dest": "document" },
    }), { ASSETS: assets });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://daftar1.com/invoices/detail/view/?id=invoice-1");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("serves router RSC requests unchanged, so client navigation still works", async () => {
    const request = new Request("https://daftar1.com/dashboard/index.txt?_rsc=current", { headers: { RSC: "1", Accept: "*/*", "Sec-Fetch-Dest": "empty" } });
    const expected = new Response('0:{"b":"current"}', { headers: { "Content-Type": "text/plain" } });
    const assets = { fetch: vi.fn().mockResolvedValue(expected) };
    expect(await worker.fetch(request, { ASSETS: assets })).toBe(expected);
    expect(assets.fetch).toHaveBeenCalledWith(request);
  });

  it("leaves robots.txt and normal pages untouched", async () => {
    const assets = { fetch: vi.fn().mockResolvedValue(new Response("asset")) };
    for (const path of ["/robots.txt", "/dashboard/", "/_next/static/app.js"]) {
      const request = new Request(`https://daftar1.com${path}`, { headers: { Accept: "text/html" } });
      await worker.fetch(request, { ASSETS: assets });
      expect(assets.fetch).toHaveBeenLastCalledWith(request);
    }
  });
});
