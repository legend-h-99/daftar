"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, ScanLine } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { OcrDraft } from "@/lib/types";
import PurchaseForm from "@/components/PurchaseForm";

/**
 * OCR flow: photograph/upload a purchase invoice → the backend extracts a
 * draft → the user reviews and edits EVERY line (with per-field confidence)
 * → only their confirmation saves anything.
 */
export default function ScanPurchasePage() {
  const [draft, setDraft] = useState<OcrDraft | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError(null);

    const imageBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setPreview(imageBase64);

    try {
      const result = await apiPost<OcrDraft>("/purchases/scan", { imageBase64 });
      setDraft(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذر قراءة الفاتورة");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          href="/purchases"
          aria-label="رجوع"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">تصوير فاتورة شراء</h1>
          <p className="text-xs text-gray-500">
            نقرأ الفاتورة ونعبّي البيانات — وأنت تراجع وتعتمد
          </p>
        </div>
      </div>

      {!draft && (
        <label
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
            scanning
              ? "border-brand-300 bg-brand-50"
              : "border-gray-300 bg-white active:bg-gray-50"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
            disabled={scanning}
          />
          <span className="rounded-full bg-brand-50 p-4 text-brand-700">
            {scanning ? (
              <ScanLine className="h-7 w-7 animate-pulse motion-reduce:animate-none" />
            ) : (
              <Camera className="h-7 w-7" />
            )}
          </span>
          <p className="font-bold text-gray-800">
            {scanning ? "جاري قراءة الفاتورة..." : "صوّر الفاتورة أو اختر صورة"}
          </p>
          <p className="text-sm text-gray-500">
            ما ينحفظ شي إلا بعد ما تراجع البيانات وتضغط حفظ
          </p>
        </label>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      {draft && (
        <>
          {draft.provider === "mock" && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              وضع تجريبي: هذه بيانات توضيحية وليست قراءة فعلية للصورة — راجعها
              وعدّلها قبل الحفظ
            </div>
          )}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="صورة الفاتورة"
              className="max-h-44 w-full rounded-2xl border border-gray-100 object-cover"
            />
          )}
          <PurchaseForm draft={draft} source="OCR" />
        </>
      )}
    </div>
  );
}
