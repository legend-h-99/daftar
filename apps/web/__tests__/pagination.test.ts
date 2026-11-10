import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ getToken: () => null, clearToken: vi.fn(), usesSessionProxy: () => true }));
vi.mock("@/lib/demo-api", () => ({ DEMO_MODE: false, demoApiFetch: vi.fn() }));
import { apiGet } from "@/lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("complete financial lists", () => {
  it("loads 1201 records, retaining the month filter on every page", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input, "https://local.invalid");
      expect(url.searchParams.get("month")).toBe("2026-10");
      const page = Number(url.searchParams.get("page"));
      return new Response(JSON.stringify(rows.slice((page - 1) * 200, page * 200)));
    });
    vi.stubGlobal("fetch", fetch);
    expect(await apiGet("/invoices?month=2026-10")).toEqual(rows);
    expect(fetch).toHaveBeenCalledTimes(7);
  });
  it("rejects the whole list when a later page fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(Array(200).fill({ id: "x" }))))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Unavailable" }), { status: 503 })));
    await expect(apiGet("/expenses?month=2026-10")).rejects.toMatchObject({ status: 503 });
  });
  it("preserves explicit pagination instead of fetching further pages", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]")); vi.stubGlobal("fetch", fetch);
    await apiGet("/purchases?page=2&limit=10"); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
