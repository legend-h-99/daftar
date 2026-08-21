import { clearToken, getToken } from "./auth";
import { DEMO_MODE, demoApiFetch } from "./demo-api";

function getLang(): "ar" | "en" {
  if (typeof window === "undefined") return "ar";
  try {
    return (localStorage.getItem("daftar_lang") as "ar" | "en") ?? "ar";
  } catch { return "ar"; }
}

// In the browser, derive the API host from the page hostname so the app works
// from any device on the local network (not just localhost).
// On non-local hostnames (tunnels, production), fall back to NEXT_PUBLIC_API_URL.
function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    // Local dev: hit the API server directly (no tunnel needed)
    if (isLocal) return `${protocol}//${hostname}:3001/api`;
    // Tunnel / production: proxy through the web server → no CORS, no second tunnel
    return "/api-proxy";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
    };
    response = DEMO_MODE
      ? await demoApiFetch(path, request)
      : await fetch(`${API_URL}${path}`, request);
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
    try {
      const data = await response.json();
      if (typeof data?.message === "string") {
        message = data.message;
      } else if (Array.isArray(data?.message)) {
        message = data.message.join("، ");
      }
    } catch {
      // response body wasn't JSON, keep the default message
    }
    throw new ApiError(message, response.status);
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

export function apiPost<T = unknown>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body });
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
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
    response = DEMO_MODE
      ? await demoApiFetch(path, request)
      : await fetch(`${API_URL}${path}`, request);
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
