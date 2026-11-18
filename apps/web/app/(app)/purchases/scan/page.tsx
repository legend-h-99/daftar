"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, FileText, ListChecks, ScanLine } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { SCAN_ENABLED } from "@/lib/features";
import { OcrDraft } from "@/lib/types";
import { prepareInvoiceImage } from "@/lib/scan-image";
import PurchaseForm from "@/components/PurchaseForm";
import { useLanguage } from "@/lib/language";

type ScanResult = OcrDraft & { remaining?: number };

/**
 * Photograph a supplier invoice → the API reads it into a draft → the owner
 * reviews every line (low-confidence lines are flagged) → only their Save
 * records anything. The photo is resized on the device and not stored.
 */
export default function ScanPurchasePage() {
  const { language } = useLanguage();
  const en = language === "en";
  const [draft, setDraft] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerManual, setOfferManual] = useState(false);

  function scanError(err: unknown): { message: string; manual: boolean } {
    const code = err instanceof ApiError ? err.code : undefined;
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 501) {
      return { manual: true, message: en ? "Automatic invoice reading is unavailable right now." : "قراءة الفاتورة آليًا غير متاحة حاليًا." };
    }
    if (code === "SCAN_QUOTA_EXCEEDED") {
      return { manual: true, message: en ? "You have used this month's scans. You can still enter the purchase manually." : "استخدمت كل صفحات المسح لهذا الشهر، وتقدر تدخل الشراء يدويًا." };
    }
    if (code === "SCAN_UNREADABLE") {
      return { manual: true, message: en ? "We could not read items from this photo. Photograph the whole invoice in good light." : "ما قدرنا نقرأ أصناف من الصورة. صوّر الفاتورة كاملة بإضاءة واضحة." };
    }
    if (code === "SCAN_IMAGE_INVALID" || !(err instanceof ApiError)) {
      return { manual: false, message: en ? "Choose a JPG, PNG or WebP photo of the invoice." : "اختر صورة JPG أو PNG أو WebP للفاتورة." };
    }
    if (code === "RATE_LIMITED") {
      return { manual: false, message: en ? "Too many scans. Wait a minute and try again." : "محاولات كثيرة، انتظر دقيقة ثم حاول مرة أخرى." };
    }
    return { manual: true, message: en ? "Could not read the invoice right now. Try again shortly." : "تعذرت قراءة الفاتورة الآن، حاول مجددًا بعد قليل." };
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    setError(null);
    setOfferManual(false);
    track("workflow_started", { workflow: "purchase" });

    try {
      const imageBase64 = await prepareInvoiceImage(file);
      setPreview(imageBase64);
      const result = await apiPost<ScanResult>("/purchases/scan", { imageBase64 });
      setDraft(result);
    } catch (err) {
      const { message, manual } = scanError(err);
      track("workflow_failed", { workflow: "purchase", status: err instanceof ApiError ? err.status : 0 });
      setPreview(null);
      setError(message);
      setOfferManual(manual);
    } finally {
      setScanning(false);
    }
  }

  const header = (
    <div className="flex items-center gap-3">
      <Link
        href="/purchases"
        aria-label={en ? "Back" : "رجوع"}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"
      >
        {en ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
      </Link>
      <div>
        <h1 className="text-xl font-extrabold text-gray-900">
          {SCAN_ENABLED ? (en ? "Scan purchase invoice" : "تصوير فاتورة شراء") : (en ? "Enter a purchase from its invoice" : "أدخل الشراء من الفاتورة")}
        </h1>
        <p className="text-xs text-gray-500">
          {SCAN_ENABLED
            ? (en ? "We read the invoice and fill in the details for you to review" : "نقرأ الفاتورة ونعبّي البيانات، وأنت تراجع وتعتمد")
            : (en ? "A simple alternative while automatic reading is unavailable" : "طريقة بديلة وبسيطة إلى أن تتوفر القراءة التلقائية")}
        </p>
      </div>
    </div>
  );

  if (!SCAN_ENABLED) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <section className="rounded-2xl border border-brand-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900">
            {en ? "Automatic invoice reading is currently off" : "قراءة الفاتورة آليًا غير مفعّلة حاليًا"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {en
              ? "Keep the invoice open as a reference and enter the supplier, date, items, quantities, and unit prices. Your photo stays on your device; this page does not upload it."
              : "افتح الفاتورة بجانبك وأدخل اسم المورد والتاريخ والأصناف والكميات وسعر الوحدة. تبقى الصورة على جهازك؛ هذه الصفحة لا ترفعها للخادم."}
          </p>
        </section>
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
            <ListChecks className="h-5 w-5 text-brand-700" aria-hidden="true" />
            {en ? "What to enter" : "البيانات المطلوبة"}
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-gray-600">
            <li>{en ? "Supplier and invoice date" : "المورد وتاريخ الفاتورة"}</li>
            <li>{en ? "Each item and its quantity" : "كل صنف وكميته"}</li>
            <li>{en ? "Unit price; the total updates automatically" : "سعر الوحدة؛ والإجمالي يُحسب تلقائيًا"}</li>
          </ul>
        </section>
        <Link
          href="/purchases/new"
          className="motion-press flex min-h-12 items-center justify-center rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white"
        >
          {en ? "Enter purchase manually" : "إدخال الشراء يدويًا"}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}

      {!draft && (
        <label
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
            scanning ? "border-brand-300 bg-brand-50" : "border-gray-300 bg-white active:bg-gray-50"
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            capture="environment"
            onChange={handleFile}
            className="sr-only"
            disabled={scanning}
            aria-label={en ? "Invoice photo" : "صورة الفاتورة"}
          />
          <span className="rounded-full bg-brand-50 p-4 text-brand-700">
            {scanning ? (
              <ScanLine className="h-7 w-7 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Camera className="h-7 w-7" aria-hidden="true" />
            )}
          </span>
          <p className="font-bold text-gray-800" aria-live="polite">
            {scanning ? (en ? "Reading invoice..." : "جاري قراءة الفاتورة...") : (en ? "Take a photo or choose an image" : "صوّر الفاتورة أو اختر صورة")}
          </p>
          <p className="text-sm text-gray-500">
            {en ? "Nothing is saved until you review the details and press Save" : "ما ينحفظ شي إلا بعد ما تراجع البيانات وتضغط حفظ"}
          </p>
        </label>
      )}

      {!draft && !scanning && (
        <p className="text-xs leading-5 text-gray-500">
          {en
            ? "The photo is sent to an AI reading service to extract the items, then discarded. It is not stored in Daftar."
            : "تُرسل الصورة إلى خدمة قراءة بالذكاء الاصطناعي لاستخراج الأصناف ثم تُحذف، ولا تُحفظ في دفتر."}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          <p>{error}</p>
          {offerManual && (
            <Link href="/purchases/new" className="mt-2 inline-flex font-bold underline underline-offset-2">
              {en ? "Enter purchase manually" : "إدخال الشراء يدويًا"}
            </Link>
          )}
        </div>
      )}

      {draft && (
        <>
          {draft.provider === "mock" || draft.provider === "demo" ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {en ? "Demo mode: these are sample details, not values read from your image. Review and edit them before saving." : "وضع تجريبي: هذه بيانات توضيحية وليست قراءة فعلية للصورة. راجعها وعدّلها قبل الحفظ."}
            </div>
          ) : (
            <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <p className="font-semibold">
                {en ? "Check every line against the invoice before saving." : "راجع كل سطر مع الفاتورة قبل الحفظ."}
              </p>
              {typeof draft.remaining === "number" && (
                <p className="mt-1 text-xs">
                  {en ? `Scans left this month: ${draft.remaining}` : `المتبقي من المسح هذا الشهر: ${draft.remaining}`}
                </p>
              )}
            </div>
          )}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={en ? "Invoice image" : "صورة الفاتورة"}
              className="max-h-44 w-full rounded-xl border border-gray-100 object-contain"
            />
          )}
          <PurchaseForm draft={draft} source="OCR" />
        </>
      )}
    </div>
  );
}
