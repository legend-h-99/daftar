import { clearToken, getToken } from "./auth";
import { DEMO_MODE, demoApiFetch } from "./demo-api";

function getLang(): "ar" | "en" {
  if (typeof window === "undefined") return "ar";
  try {
    return (localStorage.getItem("daftar_language") as "ar" | "en") ?? "ar";
  } catch { return "ar"; }
}

// In the browser, derive the API host from the page hostname so the app works
// from any device on the local network (not just localhost).
// On non-local hostnames (tunnels, production), fall back to NEXT_PUBLIC_API_URL.
function resolveApiUrl(): string {
  // Production requests use the approved Supabase API endpoint.
  const productionApiUrl = "https://nklcbcpkycrhuumpbksb.supabase.co/functions/v1/api";
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const isStaging = process.env.NEXT_PUBLIC_APP_ENV === "staging";
  let stagingApiUrl: string | null = null;
  if (isStaging && configuredApiUrl) {
    try {
      const candidate = new URL(configuredApiUrl);
      if (
        candidate.protocol === "https:" &&
        candidate.hostname.endsWith(".supabase.co") &&
        candidate.pathname.endsWith("/functions/v1/api")
      ) stagingApiUrl = candidate.toString().replace(/\/$/, "");
    } catch {
      // Ignore invalid staging URLs and keep the production endpoint fallback.
    }
  }
  const safeApiUrl = stagingApiUrl ?? productionApiUrl;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname === "daftar1.com" || hostname === "www.daftar1.com") return productionApiUrl;
    if (stagingApiUrl) return stagingApiUrl;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    // Local dev: hit the API server directly (no tunnel needed)
    if (isLocal) return `${protocol}//${hostname}:3001/api`;
    // Production (static export on Cloudflare Pages): use the configured API URL
    return safeApiUrl;
  }
  return safeApiUrl;
}

export const API_URL = resolveApiUrl();

// Supabase runs the function near the caller by default, but every request
// makes several database round trips; running it beside the database
// (Singapore) measured ~20% faster on the dashboard.
function apiRequestUrl(path: string): string {
  const url = `${API_URL}${path}`;
  if (!API_URL.includes(".supabase.co/functions/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}forceFunctionRegion=ap-southeast-1`;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function localizedApiError(data: { code?: unknown; material?: unknown }): string | null {
  const ar = getLang() === "ar";
  if (data.code === "INVALID_VAT_NUMBER") {
    return ar
      ? "الرقم الضريبي يجب أن يكون 15 رقماً يبدأ بـ 3 وينتهي بـ 3"
      : "The VAT number must be 15 digits that start and end with 3.";
  }
  if (data.code === "INVALID_CREDENTIALS") {
    return ar ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Incorrect email or password.";
  }
  if (data.code === "EMAIL_NOT_VERIFIED") {
    return ar
      ? "أكّد بريدك الإلكتروني أولاً من الرابط الذي أرسلناه إليك"
      : "Confirm your email first using the link we sent you.";
  }
  if (data.code === "RATE_LIMITED") {
    return ar ? "محاولات كثيرة، انتظر دقيقة ثم حاول مرة أخرى" : "Too many attempts. Wait a minute and try again.";
  }
  if (data.code === "INVALID_BUSINESS_NAME") {
    return ar ? "أدخل اسم المحل (100 حرف كحد أقصى)" : "Enter your business name (up to 100 characters).";
  }
  if (data.code === "INSUFFICIENT_STOCK") {
    const material = typeof data.material === "string" ? data.material : "";
    return ar
      ? `المخزون لا يكفي من «${material}». سجّل مشتريات هذه المادة أولاً ثم أعد المحاولة.`
      : `Not enough "${material}" in stock. Record a purchase of this material first, then try again.`;
  }
  return null;
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean; // attach Authorization header, defaults to true
}

/**
 * Typed fetch wrapper for the دفتر backend API.
 * - Prefixes NEXT_PUBLIC_API_URL
 * - Attaches Authorization: Bearer <token> unless auth: false
 * - Parses JSON responses and throws ApiError with a readable Arabic-friendly
 *   message on non-2xx responses.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  let response: Response;
  try {
    const request = {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Send HttpOnly cookie automatically (web); mobile uses Bearer header above.
      credentials: 'include' as RequestCredentials,
    };
    response = DEMO_MODE
      ? await demoApiFetch(path, request)
      : await fetch(apiRequestUrl(path), request);
  } catch {
    throw new ApiError(getLang() === "ar" ? "تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت" : "Could not connect to server. Check your internet connection.", 0);
  }

  if (response.status === 401 && auth) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }

  if (!response.ok) {
    let message = getLang() === "ar" ? "حدث خطأ غير متوقع، حاول مرة أخرى" : "An unexpected error occurred. Please try again.";
    let code: string | undefined;
    try {
      const data = await response.json();
      code = typeof data?.code === "string" ? data.code : undefined;
      const localized = data && typeof data === "object" ? localizedApiError(data) : null;
      if (localized) {
        message = localized;
      } else if (typeof data?.message === "string") {
        message = data.message;
      } else if (Array.isArray(data?.message)) {
        message = data.message.join("، ");
      }
    } catch {
      // response body wasn't JSON, keep the default message
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function apiGet<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPost<T = unknown>(path: string, body?: unknown, options: Pick<ApiFetchOptions, "auth" | "headers"> = {}) {
  return apiFetch<T>(path, { ...options, method: "POST", body });
}

export function apiPatch<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "PATCH", body });
}

export function apiDelete<T = unknown>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}

/**
 * Fetch a binary file (e.g. an invoice PDF) with the Authorization header
 * attached, and return it as a Blob. Plain <a href> links can't send the
 * JWT, so protected downloads must go through this helper.
 */
export async function apiGetBlob(path: string): Promise<Blob> {
  const token = getToken();
  let response: Response;
  try {
    const request = {
      credentials: 'include' as RequestCredentials,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
    response = DEMO_MODE
      ? await demoApiFetch(path, request)
      : await fetch(apiRequestUrl(path), request);
  } catch {
    throw new ApiError(getLang() === "ar" ? "تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت" : "Could not connect to server. Check your internet connection.", 0);
  }
  if (response.status === 401) {
    clearToken();
  }
  if (!response.ok) {
    throw new ApiError(getLang() === "ar" ? "تعذر تحميل الملف، حاول مرة أخرى" : "Could not download the file. Please try again.", response.status);
  }
  return response.blob();
}
