import { clearToken, getToken } from "./auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

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
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت", 0);
  }

  if (response.status === 401 && auth) {
    clearToken();
  }

  if (!response.ok) {
    let message = "حدث خطأ غير متوقع، حاول مرة أخرى";
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
    response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new ApiError("تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت", 0);
  }
  if (response.status === 401) {
    clearToken();
  }
  if (!response.ok) {
    throw new ApiError("تعذر تحميل الملف، حاول مرة أخرى", response.status);
  }
  return response.blob();
}
