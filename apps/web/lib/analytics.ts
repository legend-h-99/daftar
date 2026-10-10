// First-party, anonymous product measurement. Never send account identifiers,
// amounts, free text, query strings or full referrers. Browser events are untrusted.
export type AnalyticsEvent =
  | "user_signed_up" | "user_signed_in" | "login_started" | "login_failed"
  | "onboarding_started" | "onboarding_completed" | "product_created" | "invoice_created"
  | "expense_added" | "purchase_recorded" | "session_started"
  | "landing_viewed" | "cta_clicked" | "page_viewed"
  | "workflow_started" | "workflow_failed";
type Props = Record<string, string | number | boolean | undefined>;
const ID_KEY = "daftar_aid";
const OPT_OUT_KEY = "daftar_analytics_off";
const SESSION_KEY = "daftar_analytics_session";
const SOURCE_KEY = "daftar_analytics_source";
let memoryId: string | null = null;
let memorySession: { id: string; seen: number } | null = null;
let lastPage = "";
const EVENTS = new Set<AnalyticsEvent>(["user_signed_up", "user_signed_in", "login_started", "login_failed", "onboarding_started", "onboarding_completed", "product_created", "invoice_created", "expense_added", "purchase_recorded", "session_started", "landing_viewed", "cta_clicked", "page_viewed", "workflow_started", "workflow_failed"]);
const PATHS = new Set(["/", "/landing", "/login", "/onboarding", "/dashboard", "/products", "/products/new", "/products/edit/view", "/inventory", "/expenses", "/invoices", "/invoices/list", "/invoices/new", "/invoices/detail/view", "/purchases", "/purchases/new", "/purchases/scan", "/reports", "/plans", "/privacy", "/forgot-password", "/reset-password", "/verify-email", "/register", "/otp", "/offline"]);
function read(key: string, session = false): string | null {
  try { return (session ? window.sessionStorage : window.localStorage).getItem(key); } catch { return null; }
}
function write(key: string, value: string, session = false) {
  try { (session ? window.sessionStorage : window.localStorage).setItem(key, value); } catch { /* Measurement must never break the app. */ }
}
function enabled(): boolean {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "false") return false;
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return false;
  if (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl || read(OPT_OUT_KEY) === "1") return false;
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" || /^(www\.)?daftar1\.com$/.test(location.hostname) || location.hostname === "daftar-ead.pages.dev";
}
function deviceId(): string {
  const saved = read(ID_KEY);
  if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
  memoryId ??= crypto.randomUUID(); write(ID_KEY, memoryId); return memoryId;
}
function session(): { id: string; seen: number } {
  let value = memorySession;
  try { value = JSON.parse(read(SESSION_KEY, true) || "null") || value; } catch { /* Ignore corrupt preferences. */ }
  const now = Date.now();
  if (!value || typeof value.id !== "string" || !/^[0-9a-f-]{36}$/i.test(value.id) || !Number.isFinite(value.seen) || now - value.seen > 30 * 60_000) {
    value = { id: crypto.randomUUID(), seen: now };
    write(SOURCE_KEY, sourceFromLocation(), true);
  }
  value.seen = now; memorySession = value; write(SESSION_KEY, JSON.stringify(value), true); return value;
}
function sourceFromLocation(): string {
  const value = new URLSearchParams(location.search).get("utm_source")?.toLowerCase();
  if (["x", "twitter"].includes(value || "")) return "x";
  if (["instagram", "tiktok", "whatsapp"].includes(value || "")) return value!;
  if (value) return "other";
  try {
    const host = new URL(document.referrer).hostname;
    if (host === "t.co" || /(^|\.)(x|twitter)\.com$/.test(host)) return "x";
    for (const site of ["instagram", "tiktok", "whatsapp"]) if (host.endsWith("." + site + ".com") || host === site + ".com") return site;
    if (host === location.hostname) return "direct";
    return "other";
  } catch { return "direct"; }
}
export function isAnalyticsOptedOut(): boolean { return typeof window !== "undefined" && read(OPT_OUT_KEY) === "1"; }
export function setAnalyticsOptOut(off: boolean) {
  if (typeof window === "undefined") return;
  write(OPT_OUT_KEY, off ? "1" : "0");
  if (off) {
    memoryId = null; memorySession = null;
    try { localStorage.removeItem(ID_KEY); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SOURCE_KEY); sessionStorage.removeItem("daftar_analytics_started"); } catch { /* Storage may be unavailable. */ }
  }
}
// Strict property whitelist: never forward arbitrary caller properties.
function safeProps(props: Props): Props {
  const safe: Props = {};
  for (const key of ["has_business", "vat_enabled"]) if (typeof props[key] === "boolean") safe[key] = props[key];
  for (const key of ["items_count", "recipe_items", "days_since_last", "status"]) {
    const value = props[key]; if (typeof value === "number" && Number.isInteger(value) && value >= -1 && value <= 599) safe[key] = value;
  }
  const enums: Record<string, string[]> = { method: ["google", "email"], location: ["header", "body"], workflow: ["onboarding", "product", "invoice", "expense", "purchase"] };
  for (const [key, values] of Object.entries(enums)) if (typeof props[key] === "string" && values.includes(props[key] as string)) safe[key] = props[key];
  return safe;
}
export function track(event: AnalyticsEvent, props: Props = {}) {
  if (!enabled() || !EVENTS.has(event)) return;
  const path = location.pathname.replace(/\/$/, "") || "/";
  if (!PATHS.has(path)) return;
  try {
    const current = session();
    const source = read(SOURCE_KEY, true);
    void fetch("/api-proxy/analytics/events", {
      method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ occurredAt: new Date().toISOString(), id: crypto.randomUUID(), deviceId: deviceId(), sessionId: current.id, event, path, source: ["x", "instagram", "tiktok", "whatsapp", "direct", "other"].includes(source || "") ? source : "direct", properties: safeProps(props) }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* Analytics must never affect accounting or sign-in. */ }
}
export function trackPage(pathname: string) {
  if (!enabled() || lastPage === pathname) return;
  lastPage = pathname; track("page_viewed");
}
export function trackSessionStarted() {
  if (!enabled()) return;
  const current = session();
  if (read("daftar_analytics_started", true) === current.id) return;
  write("daftar_analytics_started", current.id, true);
  const last = Number(read("daftar_last_seen")); const now = Date.now();
  write("daftar_last_seen", String(now));
  track("session_started", { days_since_last: last ? Math.min(599, Math.floor((now - last) / 86_400_000)) : -1 });
}
