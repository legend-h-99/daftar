import { apiGet } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { formatIsoDate, roundQty } from "@/lib/format";
import type { Language } from "@/lib/language";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS_EN,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_LABELS_EN,
  type Expense,
  type Invoice,
  type InvoiceItem,
  type Purchase,
  type PurchaseItem,
} from "@/lib/types";

// The API's default page size. List screens only show the first page, but an export must be complete.
const API_PAGE_SIZE = 100;

/** Fetches every page of a month's list, so an export is never silently cut off. */
export async function fetchAllPages<T extends { id: string }>(path: string): Promise<T[]> {
  const rows = new Map<string, T>();
  for (let page = 1; ; page += 1) {
    const batch = await apiGet<T[]>(page === 1 ? path : `${path}&page=${page}`);
    const before = rows.size;
    for (const row of batch) rows.set(row.id, row);
    // No new ids means the API ignored the page number; stop instead of looping forever.
    if (batch.length < API_PAGE_SIZE || rows.size === before) return [...rows.values()];
  }
}

const money = (value: number | null | undefined) => roundQty(Number(value ?? 0), 2);

function itemsText(items: (InvoiceItem | PurchaseItem)[] | undefined, language: Language): string {
  return (items ?? [])
    .map((item) => `${item.name} × ${roundQty(item.quantity)}`)
    .join(language === "ar" ? "، " : ", ");
}

export function invoicesCsv(invoices: Invoice[], language: Language): string {
  const en = language === "en";
  const statusLabels = en ? INVOICE_STATUS_LABELS_EN : INVOICE_STATUS_LABELS;
  return toCsv(
    en
      ? ["Invoice no.", "Date", "Customer", "Status", "Items", "Before VAT", "VAT", "Total", "Paid", "Remaining", "Due date", "Notes"]
      : ["رقم الفاتورة", "التاريخ", "الزبون", "الحالة", "الأصناف", "قبل الضريبة", "الضريبة", "الإجمالي", "المدفوع", "المتبقي", "تاريخ الاستحقاق", "ملاحظات"],
    invoices.map((invoice) => {
      const paid =
        invoice.status === "PAID" ? invoice.total
          : invoice.status === "PARTIAL" ? invoice.paidAmount ?? 0
            : 0;
      return [
        invoice.number,
        formatIsoDate(invoice.issueDate || invoice.createdAt),
        invoice.customer?.name,
        statusLabels[invoice.status],
        itemsText(invoice.items, language),
        money(invoice.subtotal),
        money(invoice.vatAmount),
        money(invoice.total),
        money(paid),
        money(invoice.total - paid),
        formatIsoDate(invoice.dueDate),
        invoice.notes,
      ];
    }),
  );
}

/** Includes cost of goods sold as a row, so the file adds up to the total shown on the expenses screen. */
export function expensesCsv(expenses: Expense[], costOfGoodsSold: number, language: Language): string {
  const en = language === "en";
  const categoryLabels = en ? EXPENSE_CATEGORY_LABELS_EN : EXPENSE_CATEGORY_LABELS;
  const costRow = costOfGoodsSold > 0
    ? [[
      "",
      en ? "Cost of goods sold" : "تكلفة المخزون المباع",
      money(costOfGoodsSold),
      en ? "Calculated automatically from product recipes." : "تُحسب تلقائيًا عند بيع منتجات مرتبطة بوصفة",
    ]]
    : [];
  return toCsv(
    en ? ["Date", "Category", "Amount", "Notes"] : ["التاريخ", "البند", "المبلغ", "ملاحظات"],
    [
      ...costRow,
      ...expenses.map((expense) => [
        formatIsoDate(expense.date),
        categoryLabels[expense.category],
        money(expense.amount),
        expense.note,
      ]),
    ],
  );
}

export function purchasesCsv(purchases: Purchase[], language: Language): string {
  const en = language === "en";
  return toCsv(
    en
      ? ["Purchase no.", "Date", "Supplier", "Items", "Total", "Notes"]
      : ["رقم العملية", "التاريخ", "المورد", "الأصناف", "الإجمالي", "ملاحظات"],
    purchases.map((purchase) => [
      purchase.number,
      formatIsoDate(purchase.date),
      purchase.supplier?.name,
      itemsText(purchase.items, language),
      money(purchase.total),
      purchase.notes,
    ]),
  );
}
