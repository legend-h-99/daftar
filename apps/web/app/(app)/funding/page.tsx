"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useMonthResource } from "@/lib/use-month-resource";
import { useLanguage } from "@/lib/language";
import { formatSAR, formatDate } from "@/lib/format";
import { MonthNav } from "@/components/ui/month-nav";
import { Field, fieldClass, ErrorAlert } from "@/components/ui/form-field";

const kinds = {
  OWNER_CONTRIBUTION: ["مال أضفته للمشروع", "Owner contribution"],
  LOAN: ["قرض استلمه المشروع", "Loan received"],
  OWNER_WITHDRAWAL: ["سحب شخصي من المشروع", "Owner withdrawal"],
  LOAN_REPAYMENT: ["سداد أصل قرض", "Loan principal repayment"],
};
type Kind = keyof typeof kinds;
type Entry = {
  id: string;
  kind: Kind;
  amount: number;
  date: string;
  note: string | null;
};
type Funding = {
  entries: Entry[];
  count: number;
  cashIn: number;
  cashOut: number;
};

export default function FundingPage() {
  const { language } = useLanguage();
  const en = language === "en";
  const resource = useMonthResource<Funding>({
    load: (month) => apiGet(`/funding?month=${month}`),
    errorMessage: () =>
      en ? "Could not load financing" : "تعذر تحميل التمويل",
  });
  const [kind, setKind] = useState<Kind>("OWNER_CONTRIBUTION");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const request = useRef<{ body: string; id: string } | null>(null);
  const lock = useRef(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const value = Number(amount);
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 100000000 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
    ) {
      setError(
        en
          ? "Enter a positive amount with up to two decimal places"
          : "أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى",
      );
      return;
    }
    const body = JSON.stringify({
      kind,
      amount: value,
      date,
      note: note.trim(),
    });
    if (request.current?.body !== body)
      request.current = { body, id: crypto.randomUUID() };
    lock.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiPost("/funding", {
        ...JSON.parse(body),
        requestId: request.current.id,
      });
      setSuccess(
        en
          ? "Saved. Financing does not change profit."
          : "تم حفظ الحركة. التمويل لا يغيّر الربح.",
      );
      setAmount("");
      setNote("");
      request.current = null;
      resource.reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : en
            ? "Could not save. Retry safely."
            : "تعذر الحفظ. يمكنك إعادة المحاولة بأمان.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-brand-700 underline"
        >
          {en ? "Back to dashboard" : "العودة للرئيسية"}
        </Link>
        <h1 className="text-2xl font-bold">
          {en ? "Project financing" : "تمويل المشروع"}
        </h1>
        <p className="mt-2 text-sm leading-7 text-gray-700">
          {en
            ? "Record startup money, later contributions, loans and withdrawals separately from sales and expenses."
            : "سجّل مبلغ البداية وأي مبالغ تضيفها لاحقًا، والقروض والسحوبات، بشكل منفصل عن المبيعات والمصاريف."}
        </p>
      </div>
      <p
        role="note"
        className="rounded-xl bg-brand-50 p-4 text-sm leading-7 text-brand-900"
      >
        {en
          ? "You can start with just enough for your first purchase. Record the contribution here and the purchase under Purchases. Do not record either twice. Loan repayments here cover principal only; interest is an operating expense."
          : "يمكن أن يكون مبلغ البداية كافيًا لأول مشتريات فقط. سجّل المال الذي أضفته هنا، والمشتريات في قسم المشتريات، ولا تكرر أي عملية. سداد القرض هنا لأصل المبلغ فقط؛ تكلفة التمويل تُسجّل ضمن مصاريف التشغيل."}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <form
          onSubmit={save}
          className="space-y-4 rounded-2xl border bg-white p-5"
        >
          <h2 className="text-lg font-bold">
            {en ? "Record a money movement" : "تسجيل حركة مالية"}
          </h2>
          <Field
            label={en ? "Movement type" : "نوع الحركة"}
            htmlFor="fund-kind"
          >
            <select
              id="fund-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className={fieldClass}
              disabled={saving}
            >
              {Object.entries(kinds).map(([key, label]) => (
                <option key={key} value={key}>
                  {label[en ? 1 : 0]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={en ? "Amount (SAR)" : "المبلغ (ر.س)"}
            htmlFor="fund-amount"
          >
            <input
              id="fund-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="100000000"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={fieldClass}
              disabled={saving}
            />
          </Field>
          <Field
            label={en ? "Actual movement date" : "تاريخ الحركة الفعلي"}
            htmlFor="fund-date"
          >
            <input
              id="fund-date"
              type="date"
              required
              max={new Date(Date.now() + 3 * 3600000)
                .toISOString()
                .slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
              disabled={saving}
            />
          </Field>
          <Field
            label={en ? "Note (optional)" : "ملاحظة (اختيارية)"}
            htmlFor="fund-note"
          >
            <input
              id="fund-note"
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={fieldClass}
              disabled={saving}
            />
          </Field>
          {error && <ErrorAlert>{error}</ErrorAlert>}
          {success && (
            <p role="status" className="text-sm text-emerald-800">
              {success}
            </p>
          )}
          <button
            disabled={saving}
            className="min-h-11 w-full rounded-xl bg-brand-700 p-3 font-bold text-white disabled:opacity-60"
          >
            {saving
              ? en
                ? "Saving…"
                : "جاري الحفظ…"
              : en
                ? "Save movement"
                : "حفظ الحركة"}
          </button>
          <p className="text-sm leading-7 text-gray-600">
            {en
              ? "Check before saving. Entries are kept in history; correct a mistake with an opposite movement and an explanatory note."
              : "راجع البيانات قبل الحفظ. الحركات محفوظة في السجل؛ لتصحيح حركة، سجّل حركة عكسية مع توضيح السبب في الملاحظة."}
          </p>
        </form>
        <section
          className="space-y-4"
          aria-label={en ? "Financing history" : "سجل التمويل"}
        >
          <MonthNav
            month={resource.month}
            isCurrentMonth={resource.isCurrentMonth}
            onPrev={resource.previousMonth}
            onNext={resource.nextMonth}
          />
          {resource.error && (
            <ErrorAlert>
              {resource.error}
              <button
                type="button"
                onClick={resource.reload}
                className="min-h-11 px-3 underline"
              >
                {en ? "Retry" : "إعادة المحاولة"}
              </button>
            </ErrorAlert>
          )}
          {resource.loading && (
            <p role="status">{en ? "Loading…" : "جاري التحميل…"}</p>
          )}
          {resource.data && (
            <>
              <dl className="grid grid-cols-2 gap-3 rounded-xl border bg-white p-4">
                <div>
                  <dt>{en ? "Money in" : "الداخل"}</dt>
                  <dd className="mt-2 font-bold">
                    {formatSAR(resource.data.cashIn, language)}
                  </dd>
                </div>
                <div>
                  <dt>{en ? "Money out" : "الخارج"}</dt>
                  <dd className="mt-2 font-bold">
                    {formatSAR(resource.data.cashOut, language)}
                  </dd>
                </div>
              </dl>
              {resource.data.entries.length === 0 ? (
                <p className="rounded-xl border bg-white p-5">
                  {en
                    ? "No financing movements this month. Record your startup money when ready."
                    : "لا توجد حركات تمويل هذا الشهر. يمكنك تسجيل مبلغ البداية عندما تكون جاهزًا."}
                </p>
              ) : (
                <ul className="divide-y rounded-xl border bg-white px-4">
                  {resource.data.entries.map((row) => (
                    <li key={row.id} className="py-4">
                      <div className="flex justify-between gap-3">
                        <strong>{kinds[row.kind]?.[en ? 1 : 0]}</strong>
                        <span>{formatSAR(Number(row.amount), language)}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        {formatDate(row.date)}
                      </p>
                      {row.note && (
                        <p className="mt-2 break-words text-sm">{row.note}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {resource.data.count > 200 && (
                <p className="text-sm">
                  {en
                    ? "Showing the latest 200 movements. Totals include all movements."
                    : "تظهر آخر 200 حركة، والمجاميع تشمل جميع الحركات."}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
