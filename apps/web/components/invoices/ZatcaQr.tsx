"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { zatcaQrPayload, type ZatcaQrFields } from "@/lib/zatca";

/** ZATCA phase-1 QR code, required on simplified tax invoices of VAT-registered sellers. */
export default function ZatcaQr({ fields, label }: { fields: ZatcaQrFields; label: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const payload = zatcaQrPayload(fields);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" })
      .then((markup) => { if (!cancelled) setSvg(markup); })
      .catch(() => { if (!cancelled) setSvg(null); });
    return () => { cancelled = true; };
  }, [payload]);

  if (!svg) return null;
  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto mt-4 h-32 w-32"
      // SVG markup is generated locally by the qrcode library from invoice data.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
