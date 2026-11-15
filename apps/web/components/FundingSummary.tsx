"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { formatSAR } from "@/lib/format";
export default function FundingSummary({
  month,
  cashFlow,
  language,
}: {
  month: string;
  cashFlow: number | null;
  language: "ar" | "en";
}) {
  const [result, setResult] = useState<{
    cashIn: number;
    cashOut: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const en = language === "en";
  useEffect(() => {
    let active = true;
    setResult(null);
    setFailed(false);
    apiGet<{ cashIn: number; cashOut: number }>(`/funding?month=${month}`)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [month]);
  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">
          {en ? "Project financing" : "تمويل المشروع"}
        </h2>
        <Link
          href="/funding"
          className="inline-flex min-h-11 items-center text-sm font-bold text-brand-700 underline"
        >
          {en
            ? "Record startup money or a movement"
            : "سجّل مبلغ البداية أو حركة مالية"}
        </Link>
      </div>
      {result ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt>{en ? "Contributions and loans" : "مبالغ مضافة وقروض"}</dt>
              <dd className="mt-2 font-bold">
                {formatSAR(result.cashIn, language)}
              </dd>
            </div>
            <div>
              <dt>
                {en
                  ? "Withdrawals and principal repayments"
                  : "سحوبات وسداد أصل قروض"}
              </dt>
              <dd className="mt-2 font-bold">
                {formatSAR(result.cashOut, language)}
              </dd>
            </div>
          </dl>
          {cashFlow !== null && (
            <p className="mt-4 font-semibold">
              {en
                ? "Net cash change including financing: "
                : "صافي حركة النقد شامل التمويل: "}
              {formatSAR(cashFlow + result.cashIn - result.cashOut, language)}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          {failed
            ? en
              ? "Financing could not be loaded. No financing total is shown."
              : "تعذر تحميل التمويل؛ لا نعرض مجموعًا غير مكتمل."
            : en
              ? "Loading financing…"
              : "جاري تحميل التمويل…"}
        </p>
      )}
      <p className="mt-3 text-sm leading-7 text-gray-600">
        {en
          ? "These movements do not change profit. Net cash change covers this month, not your bank balance or cash on hand."
          : "هذه الحركات لا تغيّر الربح. صافي حركة النقد يخص هذا الشهر، وليس رصيد البنك أو النقد الفعلي المتاح."}
      </p>
    </section>
  );
}
