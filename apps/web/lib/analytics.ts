// Product analytics. No-op unless NEXT_PUBLIC_POSTHOG_KEY is set, so local dev,
// tests and the current release send nothing. Events carry an anonymous random
// device id and counts/enums only: never names, emails, amounts or free text.

export type AnalyticsEvent =
  | "user_signed_up"
  | "user_signed_in"
  | "onboarding_completed"
  | "product_created"
  | "invoice_created"
  | "expense_added"
  | "purchase_recorded"
  | "session_started"
  | "landing_viewed"
  | "cta_clicked";

type Props = Record<string, string | number | boolean | undefined>;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
const ID_KEY = "daftar_aid";
const OPT_OUT_KEY = "daftar_analytics_off";
const LAST_SEEN_KEY = "daftar_last_seen";
const SESSION_KEY = "daftar_session";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: analytics must never break the app
  }
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // storage blocked: analytics must never break the app
  }
}

// Record the page, never the record: a dynamic segment (numeric, UUID or cuid-like id)
// becomes ":id" so invoice and customer ids never leave the browser.
export function normalizePath(pathname: string): string {
  return pathname
    .split("/")
    .map((part) => (/^\d+$/.test(part) || /^[0-9a-f-]{32,36}$/i.test(part) || /^[a-z0-9]{20,}$/i.test(part) ? ":id" : part))
    .join("/");
}

function enabled(): boolean {
  if (!KEY || typeof window === "undefined") return false;
  if (navigator.doNotTrack === "1" || read(OPT_OUT_KEY) === "1") return false;
  return true;
}

function deviceId(): string {
  let id = read(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    write(ID_KEY, id);
  }
  return id;
}

export function isAnalyticsOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  return read(OPT_OUT_KEY) === "1";
}

export function setAnalyticsOptOut(off: boolean) {
  if (typeof window === "undefined") return;
  write(OPT_OUT_KEY, off ? "1" : "0");
  if (off) {
    // Opting out also forgets the device id, so a later opt-in starts anonymous again.
    try {
      window.localStorage.removeItem(ID_KEY);
    } catch {
      // ignore
    }
  }
}

export function track(event: AnalyticsEvent, props: Props = {}) {
  if (!enabled()) return;
  try {
    void fetch(`${HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: deviceId(),
        properties: { ...props, $process_person_profile: false, path: normalizePath(window.location.pathname) },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never throw from tracking
  }
}

// Once per browser session (tab), not per page load, so days_since_last measures the gap
// between sessions and reloads do not reset it. Feeds retention.
export function trackSessionStarted() {
  if (!enabled()) return;
  if (readSession(SESSION_KEY) === "1") return;
  writeSession(SESSION_KEY, "1");
  const last = Number(read(LAST_SEEN_KEY));
  const now = Date.now();
  write(LAST_SEEN_KEY, String(now));
  track("session_started", {
    days_since_last: last ? Math.floor((now - last) / 86_400_000) : -1,
  });
}
