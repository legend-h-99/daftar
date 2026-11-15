import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Execute the exact deployed Worker source. The test runner has no HTMLRewriter, so a small
// stand-in rewrites only the `<script>` tags, which is all the Worker asks of it.
const source = readFileSync(resolve(process.cwd(), "public/_worker.js"), "utf8")
  .replace("export default worker;", "globalThis.worker = worker;");

class FakeElement {
  private readonly attributes = new Map<string, string | null>();
  constructor(tag: string) {
    for (const match of tag.matchAll(/\s([a-zA-Z-]+)(?:="([^"]*)")?/g)) {
      // Boolean attributes such as `async` have no value and are serialized without one.
      this.attributes.set(match[1], match[2] ?? null);
    }
  }
  hasAttribute(name: string) { return this.attributes.has(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  toString() {
    const attrs = [...this.attributes]
      .map(([k, v]) => (v === null ? ` ${k}` : ` ${k}="${v}"`)).join("");
    return `<script${attrs}>`;
  }
}

class FakeHTMLRewriter {
  private readonly handlers: Array<{ element(el: FakeElement): void }> = [];
  on(selector: string, handler: { element(el: FakeElement): void }) {
    if (selector === "script") this.handlers.push(handler);
    return this;
  }
  transform(response: Response) {
    const handlers = this.handlers;
    const body = new ReadableStream({
      async start(controller) {
        const html = await response.text();
        const out = html.replace(/<script\b[^>]*>/g, tag => {
          const element = new FakeElement(tag);
          for (const handler of handlers) handler.element(element);
          return element.toString();
        });
        controller.enqueue(new TextEncoder().encode(out));
        controller.close();
      },
    });
    return new Response(body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  }
}

const sandbox = {
  URL, Headers, Request, Response, ReadableStream, TextEncoder, atob, btoa, Date, Uint8Array,
  crypto: globalThis.crypto, HTMLRewriter: FakeHTMLRewriter, worker: undefined as unknown,
};
runInNewContext(source, sandbox);
const worker = sandbox.worker as { fetch(req: Request, env: Record<string, unknown>): Promise<Response> };

const html = `<!doctype html><html><head><script>window.theme = "dark"</script>` +
  `<script src="/_next/static/chunks/app.js" async></script></head>` +
  `<body><script>self.__next_f.push([0])</script></body></html>`;
const assets = vi.fn(async (_request: Request) => new Response(html, {
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: '"page-v1"',
    "Content-Length": String(html.length),
  },
}));
const env = { ASSETS: { fetch: assets } };
const documentRequest = (path: string, headers: Record<string, string> = {}) =>
  new Request(`https://daftar1.com${path}`, {
    headers: { "Sec-Fetch-Dest": "document", Accept: "text/html", ...headers },
  });
const nonceOf = (csp: string | null) => csp?.match(/'nonce-([^']+)'/)?.[1] ?? "";
// The Worker emits base64url nonces, so only URL-safe characters are expected.
const scriptSrc = (csp: string) => csp.split("; ").find(d => d.startsWith("script-src")) ?? "";

beforeEach(() => { assets.mockClear(); });

describe("per-response CSP nonce for HTML documents", () => {
  it("drops unsafe-inline from script-src and keeps the rest of the policy", async () => {
    const csp = (await worker.fetch(documentRequest("/login"), env)).headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/'nonce-[A-Za-z0-9_-]{16,}'/);
    expect(scriptSrc(csp)).not.toContain("'unsafe-inline'");
    expect(scriptSrc(csp)).toContain("https://accounts.google.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://accounts.google.com");
    for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(csp).toContain(directive);
    }
  });

  it("gives every inline script the response nonce and leaves external scripts alone", async () => {
    const res = await worker.fetch(documentRequest("/"), env);
    const nonce = nonceOf(res.headers.get("Content-Security-Policy"));
    const body = await res.text();
    expect(body.split(`<script nonce="${nonce}">`).length - 1).toBe(2);
    expect(body).toContain('<script src="/_next/static/chunks/app.js" async>');
    expect(body).not.toMatch(/<script nonce="[^"]*" src=/);
  });

  it("uses a fresh nonce for each response", async () => {
    const first = nonceOf((await worker.fetch(documentRequest("/"), env)).headers.get("Content-Security-Policy"));
    const second = nonceOf((await worker.fetch(documentRequest("/"), env)).headers.get("Content-Security-Policy"));
    expect(first).not.toBe("");
    expect(second).not.toBe(first);
  });

  it("drops the asset's validators and length from HTML, so a cached copy cannot drift from its nonce", async () => {
    const res = await worker.fetch(documentRequest("/"), env);
    expect(res.headers.get("ETag")).toBeNull();
    expect(res.headers.get("Content-Length")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("passes a 304 through without a new CSP, keeping the policy that matches the cached body", async () => {
    assets.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const res = await worker.fetch(documentRequest("/", { "If-None-Match": '"page-v1"' }), env);
    expect(res.status).toBe(304);
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("decides by response type, so a page without Accept headers still gets the policy", async () => {
    const bare = new Request("https://daftar1.com/no-such-page/");
    const res = await worker.fetch(bare, env);
    expect(nonceOf(res.headers.get("Content-Security-Policy"))).not.toBe("");
  });

  it("leaves non-HTML assets and RSC fetches untouched", async () => {
    assets.mockResolvedValueOnce(new Response("console.log(1)", {
      headers: { "Content-Type": "text/javascript" },
    }));
    const script = new Request("https://daftar1.com/_next/static/chunks/app.js", {
      headers: { "Sec-Fetch-Dest": "script" },
    });
    const res = await worker.fetch(script, env);
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
    expect(await res.text()).toBe("console.log(1)");

    assets.mockResolvedValueOnce(new Response("0:{}", { headers: { "Content-Type": "text/x-component" } }));
    const rsc = new Request("https://daftar1.com/login?_rsc=1", {
      headers: { Accept: "text/x-component" },
    });
    expect((await worker.fetch(rsc, env)).headers.get("Content-Security-Policy")).toBeNull();
  });

  it("keeps the static _headers file from setting a second CSP", () => {
    const headers = readFileSync(resolve(process.cwd(), "public/_headers"), "utf8");
    expect(headers).not.toMatch(/^\s+Content-Security-Policy:/m);
    expect(headers).toContain("X-Frame-Options: DENY");
  });
});

describe("Pages routing sends documents through the Worker", () => {
  it("includes every path, so HTML cannot bypass the nonce-setting Worker", () => {
    const routes = JSON.parse(readFileSync(resolve(process.cwd(), "public/_routes.json"), "utf8")) as {
      include: string[]; exclude: string[];
    };
    expect(routes.include).toContain("/*");
    // Only content-hashed build output is served without the Worker.
    expect(routes.exclude).toEqual(["/_next/static/*"]);
  });
});
