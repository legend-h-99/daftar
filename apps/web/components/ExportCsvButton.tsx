"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { useLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

export default function ExportCsvButton({
  filename,
  buildCsv,
  className,
}: {
  filename: string;
  buildCsv: () => Promise<string>;
  className?: string;
}) {
  const { language } = useLanguage();
  const en = language === "en";
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleExport() {
    setBusy(true);
    setFailed(false);
    try {
      downloadCsv(filename, await buildCsv());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("print:hidden", className)}>
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 active:bg-gray-50 disabled:opacity-60"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy
          ? (en ? "Preparing the file…" : "جاري تجهيز الملف…")
          : (en ? "Export to Excel (CSV)" : "تصدير إكسل (CSV)")}
      </button>
      {failed && (
        <p role="alert" className="mt-1.5 text-center text-xs font-medium text-red-600">
          {en ? "Could not export the file. Try again." : "تعذر تصدير الملف، حاول مرة ثانية."}
        </p>
      )}
    </div>
  );
}
