/**
 * Formats a number as Saudi Riyal currency, e.g. formatSAR(1250) => "1,250.00 ر.س"
 */
export function formatSAR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ر.س`;
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

export function formatMonthLabel(monthStr: string): string {
  // monthStr: "YYYY-MM"
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month) return monthStr;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
}

export function currentMonthStr(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
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
