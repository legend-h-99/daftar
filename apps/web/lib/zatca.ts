/**
 * ZATCA (Saudi e-invoicing, phase 1) QR payload for simplified tax invoices:
 * a base64-encoded TLV string with the seller name, VAT number, invoice
 * timestamp, total including VAT, and the VAT amount.
 */
export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601
  total: number; // including VAT
  vatAmount: number;
}

function tlv(tag: number, value: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 255) throw new Error(`ZATCA field ${tag} is too long`);
  return [tag, bytes.length, ...bytes];
}

export function zatcaQrPayload(fields: ZatcaQrFields): string {
  const bytes = [
    ...tlv(1, fields.sellerName),
    ...tlv(2, fields.vatNumber),
    ...tlv(3, fields.timestamp),
    ...tlv(4, fields.total.toFixed(2)),
    ...tlv(5, fields.vatAmount.toFixed(2)),
  ];
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
