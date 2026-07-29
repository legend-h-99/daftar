// Hermes doesn't support the `nu-latn` Unicode locale extension, so we
// format with the Arabic locale (for currency symbol + structure) then
// replace Arabic-Indic digits (٠-٩ U+0660–U+0669) with Latin (0-9).
function latinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export function formatSAR(n: number, fractionDigits = 0): string {
  return latinDigits(
    n.toLocaleString('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }),
  );
}

export function formatDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  const opts = options ?? { day: 'numeric', month: 'short' };
  return latinDigits(new Date(iso).toLocaleDateString('ar-SA', opts));
}

export function formatDateNow(options?: Intl.DateTimeFormatOptions): string {
  const opts = options ?? { month: 'long', year: 'numeric' };
  return latinDigits(new Date().toLocaleDateString('ar-SA', opts));
}
