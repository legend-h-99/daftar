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
    return env.ASSETS.fetch(request);
  },
};

export default worker;
