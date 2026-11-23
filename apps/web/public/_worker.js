const COOKIE_NAME = "__Host-daftar_session";
const PRODUCTION_API = "https://nklcbcpkycrhuumpbksb.supabase.co/functions/v1/api";
const SESSION_PATHS = new Set([
  "/auth/google", "/auth/email/login", "/auth/email/verify",
  "/auth/password/reset", "/auth/otp/verify", "/auth/demo", "/onboarding",
]);

function sessionCookie(token, maxAge) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function failure(message, status, clear = false) {
  const headers = new Headers({
    "Content-Type": "application/json", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (clear) headers.set("Set-Cookie", sessionCookie("", 0));
  return new Response(JSON.stringify({ message, statusCode: status }), { status, headers });
}

async function proxy(request, env, url) {
  const path = url.pathname.slice("/api-proxy".length).replace(/\/$/, "");
  const logout = request.method === "POST" && path === "/auth/logout";
  // Cloudflare branch previews must not silently use the production database.
  // Enable only after configuring an isolated staging API for that preview.
  if (url.hostname.endsWith(".pages.dev") && url.hostname !== "daftar-ead.pages.dev" &&
      env.DAFTAR_PREVIEW_API_ENABLED !== "true") {
    return failure("هذه نسخة معاينة؛ استخدم daftar1.com لحسابات نشاطك", 503, logout);
  }
  const safe = request.method === "GET" || request.method === "HEAD";
  const origin = request.headers.get("Origin");
  // Validate the browser's origin even for login (login CSRF). Do not trust
  // client Authorization, forwarding headers, or arbitrary upstream URLs.
  if (request.headers.get("Sec-Fetch-Site") === "cross-site" ||
      (origin && origin !== url.origin) || (!safe && origin !== url.origin)) {
    return failure("الطلب غير مسموح من هذا الموقع", 403);
  }
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    return failure("طريقة الطلب غير مدعومة", 405);
  }
  let target;
  try {
    target = new URL(env.DAFTAR_API_URL || PRODUCTION_API);
    if (target.protocol !== "https:" || !target.hostname.endsWith(".supabase.co") ||
        target.pathname !== "/functions/v1/api" || target.username || target.password || target.search || target.hash) {
      throw new Error("Invalid API configuration");
    }
  } catch {
    return failure("تعذر الاتصال بالخادم", 503, logout);
  }
  // Appending to pathname cannot change the configured upstream origin.
  target.pathname += path;
  target.search = url.search;
  target.searchParams.set("forceFunctionRegion", "ap-southeast-1");
  const headers = new Headers();
  for (const name of ["Content-Type", "Accept", "Idempotency-Key"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = request.headers.get("Cookie")?.split(";")
    .map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (token && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  // Cloudflare supplies this header, preventing browser spoofing of rate-limit IPs.
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) headers.set("CF-Connecting-IP", ip);
  // The Edge function trusts CF-Connecting-IP only together with this secret (see clientIp there).
  if (env.EDGE_SHARED_SECRET) headers.set("x-daftar-edge-secret", env.EDGE_SHARED_SECRET);
  try {
    const upstream = await fetch(target, {
      method: request.method, headers,
      body: safe ? undefined : await request.arrayBuffer(),
      redirect: "manual",
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return failure("تعذر الاتصال بالخادم", 502, logout);
    }
    const responseHeaders = new Headers({
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["Content-Type", "Content-Disposition", "Retry-After"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (logout || (upstream.status === 401 && !SESSION_PATHS.has(path))) {
      responseHeaders.set("Set-Cookie", sessionCookie("", 0));
    }
    let body = upstream.body;
    if (request.method !== "HEAD" && upstream.status !== 204 &&
        upstream.headers.get("Content-Type")?.includes("application/json")) {
      const data = await upstream.json();
      if (data && typeof data === "object" && "accessToken" in data) {
        const issuedToken = data.accessToken;
        delete data.accessToken;
        if (upstream.ok && request.method === "POST" && SESSION_PATHS.has(path)) {
          if (typeof issuedToken !== "string" || issuedToken.length > 3500 ||
              !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(issuedToken)) {
            return failure("تعذر إنشاء جلسة الدخول", 502);
          }
          const encoded = issuedToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
          const claims = JSON.parse(atob(encoded + "=".repeat((4 - encoded.length % 4) % 4)));
          const maxAge = Math.min(7 * 86400, Math.floor(claims.exp - Date.now() / 1000));
          if (!Number.isFinite(maxAge) || maxAge <= 0) return failure("انتهت جلسة الدخول", 401, true);
          responseHeaders.set("Set-Cookie", sessionCookie(issuedToken, maxAge));
          data.sessionAuthenticated = true;
        }
      }
      body = JSON.stringify(data);
    }
    return new Response(request.method === "HEAD" || upstream.status === 204 ? null : body, {
      status: upstream.status, headers: responseHeaders,
    });
  } catch {
    return failure("تعذر الاتصال بالخادم، حاول مرة أخرى", 502, logout);
  }
}

// Every HTML document gets its own nonce. Next's static export inlines an RSC payload into each
// page, so a fixed hash cannot cover those scripts; a nonce generated per response can.
function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64url keeps the value free of characters that need escaping in a header or an attribute.
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function contentSecurityPolicy(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://accounts.google.com https://www.gstatic.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "img-src 'self' data: blob: https://accounts.google.com https://www.gstatic.com",
    "font-src 'self'",
    "connect-src 'self' https://nklcbcpkycrhuumpbksb.supabase.co https://accounts.google.com https://*.ingest.sentry.io https://cloudflareinsights.com",
    "frame-src https://accounts.google.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// The nonce is chosen by response type, not by request headers, so an HTML page cannot escape
// the policy by asking without an Accept header.
async function withNonce(response) {
  // A 304 has no body and no CSP of its own. The browser keeps the CSP it stored with the cached
  // copy, and that copy carries the matching nonce, so the 304 is passed through unchanged.
  if (response.status === 304) return response;
  if (!(response.headers.get("Content-Type") || "").includes("text/html")) return response;
  const nonce = createNonce();
  const rewritten = new HTMLRewriter()
    .on("script", {
      element(element) {
        // External scripts are allowed by their host; only inline scripts need the nonce.
        if (!element.hasAttribute("src")) element.setAttribute("nonce", nonce);
      },
    })
    .transform(response);
  const headers = new Headers(rewritten.headers);
  // The body changed and carries a per-response nonce, so no validator or length may survive.
  headers.delete("Content-Length");
  headers.delete("ETag");
  headers.delete("Last-Modified");
  headers.set("Cache-Control", "no-cache");
  headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  return new Response(rewritten.body, {
    status: rewritten.status, statusText: rewritten.statusText, headers,
  });
}

// Next's static-export client can fall back to a document navigation to
// index.txt when an already-open tab sees a new deployment's build ID.
// Recover that navigation without redirecting the router's RSC fetches.
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api-proxy/")) return proxy(request, env, url);
    const documentRequest = request.headers.get("Sec-Fetch-Dest") === "document" ||
      request.headers.get("Accept")?.includes("text/html");
    if ((request.method === "GET" || request.method === "HEAD") &&
        documentRequest && url.pathname.endsWith("/index.txt")) {
      url.pathname = url.pathname.slice(0, -"index.txt".length);
      url.searchParams.delete("_rsc");
      return new Response(null, {
        status: 302,
        headers: {
          Location: url.toString(),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    // Only build output under /_next/static bypasses the Worker (_routes.json); everything else lands here.
    return withNonce(await env.ASSETS.fetch(request));
  },
};

export default worker;
