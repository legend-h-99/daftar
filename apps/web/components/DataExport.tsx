"use client";
import { useEffect, useState } from "react";
import { apiGetBlob, ApiError } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export default function DataExport({ ar }: { ar: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(isAuthenticated()), []);
  if (!signedIn) {
    return <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{ar ? "زر تنزيل بيانات نشاطك يظهر هنا بعد تسجيل الدخول." : "The button to download your business data appears here after you sign in."}</p>;
  }
  async function download() {
    setBusy(true); setError(null);
    try {
      const blob = await apiGetBlob("/business/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "daftar-business-export.json";
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof ApiError ? e.message : ar ? "تعذر التصدير" : "Export failed"); }
    finally { setBusy(false); }
  }
  return <div className="mt-6"><button type="button" disabled={busy} onClick={download} className="min-h-11 rounded-lg bg-primary px-4 py-2 text-primary-foreground">{busy ? (ar ? "جاري التصدير..." : "Exporting...") : (ar ? "تنزيل بيانات نشاطي" : "Download my business data")}</button>{error && <p role="alert">{error}</p>}</div>;
}
