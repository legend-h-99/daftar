import { formatSAR } from "@/lib/format";

/** مقارنة بصرية بأعمدة أفقية: مبيعات مقابل مشتريات ومصاريف. */
export default function CostBar({
  sales,
  purchases,
  expenses,
}: {
  sales: number;
  purchases: number;
  expenses: number;
}) {
  const totalCosts = purchases + expenses;
  const isLoss = totalCosts > sales;
  const base = Math.max(sales, totalCosts) || 1;

  const salesW = Math.round((sales / base) * 100);
  const purchasesW = Math.round((purchases / base) * 100);
  const expensesW = Math.round((expenses / base) * 100);

  return (
    <div className="flex flex-col gap-2">
      {/* Sales bar */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">مبيعات</span>
        <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <div
            className="flex items-center justify-end rounded-lg bg-brand-500 px-2 transition-all"
            style={{ width: `${salesW}%` }}
          >
            {salesW > 15 && (
              <span className="text-[10px] font-bold text-white">{formatSAR(sales)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Purchases bar */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">مشتريات</span>
        <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <div
            className="flex items-center justify-end rounded-lg bg-amber-400 px-2 transition-all"
            style={{ width: `${purchasesW}%` }}
          >
            {purchasesW > 15 && (
              <span className="text-[10px] font-bold text-amber-900">{formatSAR(purchases)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Expenses bar */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right text-xs text-gray-400">مصاريف</span>
        <div className="flex h-7 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <div
            className="flex items-center justify-end rounded-lg bg-red-400 px-2 transition-all"
            style={{ width: `${expensesW}%` }}
          >
            {expensesW > 15 && (
              <span className="text-[10px] font-bold text-white">{formatSAR(expenses)}</span>
            )}
          </div>
        </div>
      </div>

      {isLoss && (
        <p className="text-center text-xs font-medium text-red-500">
          التكاليف تتجاوز المبيعات — خسارة هذا الشهر
        </p>
      )}
    </div>
  );
}
