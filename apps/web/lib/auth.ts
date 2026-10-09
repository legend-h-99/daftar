// Production bearer credentials live only in the Worker-managed HttpOnly cookie.
// This marker is a navigation hint, never an authorization decision. The API
// validates the cookie on every request. Local development uses memory only.
const SESSION_HINT = "daftar_session";
let memoryToken: string | null = null;
let sessionHint = false;

export function usesSessionProxy(): boolean {
  if (process.env.NEXT_PUBLIC_SESSION_PROXY_ENABLED === "true") return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "daftar1.com" || host === "www.daftar1.com" || host.endsWith(".pages.dev");
}

function removeLegacyToken(): void {
  try { window.localStorage.removeItem("daftar_token"); } catch { /* Storage may be unavailable. */ }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  removeLegacyToken();
  return usesSessionProxy() ? null : memoryToken;
}

export function setToken(token?: string, sessionAuthenticated = false): void {
  if (typeof window === "undefined") return;
  if (!token && !sessionAuthenticated) throw new Error("لم يتم إنشاء جلسة الدخول");
  removeLegacyToken();
  memoryToken = usesSessionProxy() ? null : token ?? null;
  sessionHint = true;
  try { window.localStorage.setItem(SESSION_HINT, "1"); } catch { /* In-memory hint still works. */ }
}

export function clearToken(): void {
  memoryToken = null;
  sessionHint = false;
  if (typeof window === "undefined") return;
  removeLegacyToken();
  try { window.localStorage.removeItem(SESSION_HINT); } catch { /* Storage may be unavailable. */ }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  removeLegacyToken();
  if (!usesSessionProxy()) return !!memoryToken;
  try { return window.localStorage.getItem(SESSION_HINT) === "1"; } catch { return sessionHint; }
}
