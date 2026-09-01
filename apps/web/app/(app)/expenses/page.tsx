"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { apiDelete, apiGet, ApiError } from "@/lib/api";
import { formatDate, formatMonthLabel, formatSAR } from "@/lib/format";
import { DashboardSummary, EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_LABELS_EN, Expense } from "@/lib/types";
import { useMonthResource } from "@/lib/use-month-resource";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AddExpenseSheet from "@/components/expenses/AddExpenseSheet";
import { MonthNav } from "@/components/ui/month-nav";
import { useLanguage } from "@/lib/language";

export default function ExpensesPage() {
  const { language } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    month,
    data,
    error: loadError,
    isCurrentMonth,
    previousMonth,
    nextMonth,
    reload,
  } = useMonthResource<{ expenses: Expense[]; summary: DashboardSummary | null }>({
    load: async (targetMonth) => {
      const [expenses, summary] = await Promise.all([
        apiGet<Expense[]>(`/expenses?month=${targetMonth}`),
        apiGet<DashboardSummary>(`/dashboard/summary?month=${targetMonth}`).catch(() => null),
      ]);
      return { expenses, summary };
    },
    errorMessage: (err) => err instanceof ApiError ? err.message : language === "ar" ? "تعذر تحميل المصاريف" : "Could not load expenses",
  });

  const expenses = data?.expenses ?? null;
  const summary = data?.summary ?? null;
  const costOfGoodsSold = summary?.costOfGoodsSold ?? 0;

  const total = useMemo(
    () => (expenses || []).reduce((sum, e) => sum + e.amount, 0) + costOfGoodsSold,
    [expenses, costOfGoodsSold],
  );

  // Group expenses by category for the breakdown
  const byCategory = useMemo(() => {
    if (!expenses) return [];
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    if (costOfGoodsSold > 0) {
      map.set("COGS", costOfGoodsSold);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        category: cat as keyof typeof EXPENSE_CATEGORY_LABELS | "COGS",
        amount,
        pct: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [expenses, costOfGoodsSold, total]);

  function expenseLabel(category: keyof typeof EXPENSE_CATEGORY_LABELS | "COGS") {
    return category === "COGS"
      ? language === "ar" ? "تكلفة المخزون المباع" : "Cost of goods sold"
      : (language === "ar" ? EXPENSE_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS_EN)[category];
  }

  async function handleDelete(id: string) {
    if (deletingId === id) {
      // Second tap — confirm delete
      try {
        await apiDelete(`/expenses/${id}`);
        setDeletingId(null);
        setActionError(null);
        reload();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : language === "ar" ? "تعذر حذف المصروف" : "Could not delete expense");
        setDeletingId(null);
      }
    } else {
      setDeletingId(id);
    }
  }

  return (
    <div className="flex flex-col gap-4" onClick={() => setDeletingId(null)}>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-gray-900">
          {language === "ar" ? "المصاريف" : "Expenses"}
        </h1>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowForm(true); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm active:bg-brand-800"
          aria-label={language === "ar" ? "إضافة مصروف" : "Add expense"}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <MonthNav month={month} isCurrentMonth={isCurrentMonth} onPrev={previousMonth} onNext={nextMonth} />

      {expenses && total > 0 && (
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-500">
              {language === "ar" ? `إجمالي مصاريف ${formatMonthLabel(month, language)}` : `Total expenses in ${formatMonthLabel(month, language)}`}
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-red-600">
              {formatSAR(total, language)}
            </span>
          </div>
          {byCategory.length > 1 && (
            <div className="mt-4 flex flex-col gap-2.5 border-t border-gray-100 pt-4">
              {byCategory.map(({ category, amount, pct }) => (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {expenseLabel(category)}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatSAR(amount, language)}
                      <span className="mr-1.5 text-xs font-normal text-gray-400">{pct}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-red-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(loadError || actionError) && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 rounded-2xl">
          <AlertDescription className="text-red-600 font-medium">
            {loadError || actionError}
          </AlertDescription>
        </Alert>
      )}

      {!expenses && !loadError && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {expenses && total === 0 && (
        <EmptyState
          icon={Wallet}
          title={language === "ar" ? "لا توجد مصاريف مسجلة" : "No expenses recorded"}
          description={language === "ar" ? "سجّل مصاريف محلك عشان تعرف صافي ربحك بدقة" : "Record business expenses to calculate net profit accurately."}
          actionLabel={language === "ar" ? "إضافة مصروف" : "Add expense"}
          onAction={() => setShowForm(true)}
        />
      )}

      {expenses && (expenses.length > 0 || costOfGoodsSold > 0) && (
        <ul className="flex flex-col gap-2">
          {costOfGoodsSold > 0 && (
            <li className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-4 py-3.5 shadow-sm">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-amber-900">
                  {language === "ar" ? "تكلفة المخزون المباع" : "Cost of goods sold"}
                </span>
                <span className="text-xs text-amber-700">
                  {language === "ar" ? "تُحسب تلقائيًا عند بيع منتجات مرتبطة بوصفة" : "Calculated automatically from product recipes."}
                </span>
              </div>
              <span className="font-bold text-amber-900">
                {formatSAR(costOfGoodsSold, language)}
              </span>
            </li>
          )}
          {expenses.map((exp) => (
            <li
              key={exp.id}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-900">
                  {(language === "ar" ? EXPENSE_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS_EN)[exp.category]}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(exp.date)}
                  {exp.note ? ` · ${exp.note}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-900">
                  {formatSAR(exp.amount, language)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  aria-label={deletingId === exp.id ? (language === "ar" ? "تأكيد الحذف" : "Confirm delete") : (language === "ar" ? "حذف" : "Delete")}
                  className={`flex h-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-all active:scale-95 ${
                    deletingId === exp.id
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-500 active:bg-red-100"
                  }`}
                >
                  {deletingId === exp.id ? (
                    language === "ar" ? "تأكيد" : "Confirm"
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <AddExpenseSheet
          onClose={() => setShowForm(false)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
