/**
 * Rounds a quantity to a fixed number of decimals for display,
 * e.g. roundQty(2.4999) => 2.5. Default 3 decimals for stock quantities.
 */
export function roundQty(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * نسبة مئوية مقرّبة لعدد صحيح، e.g. percentOf(25, 200) => 13.
 * تُعيد 0 إذا كان المقام صفرًا.
 */
export function percentOf(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Formats a number as Saudi Riyal currency, e.g. formatSAR(1250) => "1,250.00 ر.س"
 */
export function formatSAR(
  amount: number | null | undefined,
  locale: "ar" | "en" = "ar",
): string {
  const value = Number(amount ?? 0);
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return locale === "en" ? `SAR ${formatted}` : `${formatted} ر.س`;
}

/**
 * Formats a date string/Date into an Arabic-friendly short date, e.g. ١٢‏/٠٧‏/٢٠٢٥
 * We keep Western digits for clarity/consistency with numeric inputs.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatMonthLabel(monthStr: string, locale: "ar" | "en" = "ar"): string {
  // monthStr: "YYYY-MM"
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month) return monthStr;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(locale === "en" ? "en-US" : "ar-SA", {
    year: "numeric",
    month: "long",
  });
}

export function currentMonthStr(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function toMonthStr(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Normalizes a Saudi phone number to international format without the plus,
 * e.g. "0512345678" => "966512345678". Used for wa.me links.
 */
export function normalizeSaudiPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return digits;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  return `966${digits}`;
}
