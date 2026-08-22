import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Expense } from "@/lib/types";

// ── Static mocks ─────────────────────────────────────────────────────────────

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, currentMonthStr: vi.fn() };
});

vi.mock("@/components/EmptyState", () => ({
  default: ({ title, actionLabel, onAction }: {
    title: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <div>
      <p>{title}</p>
      {actionLabel && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
}));

// نحاكي النافذة السفلية لإضافة مصروف لتجنّب تبعياتها
vi.mock("@/components/expenses/AddExpenseSheet", () => ({
  default: ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => (
    <div data-testid="add-expense-sheet">
      <button onClick={onClose}>إغلاق</button>
      <button onClick={onSaved}>حفظ</button>
    </div>
  ),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import ExpensesPage from "@/app/(app)/expenses/page";
import { apiGet, apiDelete } from "@/lib/api";
import { currentMonthStr } from "@/lib/format";

// ── Helpers ──────────────────────────────────────────────────────────────────

let monthCounter = 0;
function nextFakeMonth(): string {
  monthCounter++;
  const y = 2000 + Math.floor((monthCounter - 1) / 12);
  const m = String(((monthCounter - 1) % 12) + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    category: "RENT",
    amount: 1000,
    date: "2025-01-10",
    note: null,
    ...overrides,
  };
}

/** يُهيئ apiGet ليرد بقائمة مصاريف وملخص اختياري */
function mockLoad(expenses: Expense[], costOfGoodsSold = 0) {
  vi.mocked(apiGet).mockImplementation(async (path: string) => {
    if (path.includes("/expenses")) return expenses;
    if (path.includes("/dashboard/summary")) {
      return costOfGoodsSold > 0
        ? { costOfGoodsSold, totalSales: 0, totalPurchases: 0, operatingExpenses: 0, totalExpenses: 0, netProfit: 0, unpaidInvoices: [], unpaidInvoicesCount: 0, unpaidInvoicesTotal: 0, unpaidInvoicesLimitedTo: 5, lowStock: [] }
        : (() => { throw new Error("no summary"); })();
    }
    return null;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة المصاريف (Expenses)", () => {
  beforeEach(() => {
    vi.mocked(currentMonthStr).mockReturnValue(nextFakeMonth());
    vi.mocked(apiGet).mockReset();
    vi.mocked(apiDelete).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── العرض الأولي ─────────────────────────────────────────────────────────

  describe("العرض الأولي", () => {
    it("يعرض العنوان وزر الإضافة", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<ExpensesPage />);
      expect(screen.getByText("المصاريف")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "إضافة مصروف" }),
      ).toBeInTheDocument();
    });

    it("يعرض أزرار التنقل بين الأشهر", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<ExpensesPage />);
      expect(
        screen.getByRole("button", { name: "الشهر السابق" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "الشهر التالي" }),
      ).toBeDisabled();
    });
  });

  // ── حالة التحميل ─────────────────────────────────────────────────────────

  describe("حالة التحميل", () => {
    it("يعرض هيكل عظمي أثناء الجلب", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<ExpensesPage />);
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  // ── حالة الخطأ ───────────────────────────────────────────────────────────

  describe("حالة الخطأ", () => {
    it("يعرض رسالة الخطأ الافتراضية عند فشل جلب المصاريف", async () => {
      vi.mocked(apiGet).mockRejectedValue(new Error("network"));
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("تعذر تحميل المصاريف")).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError كما هي", async () => {
      const { ApiError } = await import("@/lib/api");
      vi.mocked(apiGet).mockRejectedValue(new ApiError("خطأ في الخادم", 500));
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("خطأ في الخادم")).toBeInTheDocument(),
      );
    });
  });

  // ── الحالة الفارغة ────────────────────────────────────────────────────────

  describe("الحالة الفارغة", () => {
    it("يعرض رسالة لا مصاريف عند القائمة الفارغة", async () => {
      mockLoad([]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(
          screen.getByText("لا توجد مصاريف مسجلة"),
        ).toBeInTheDocument(),
      );
    });

    it("زر 'إضافة مصروف' في الحالة الفارغة يفتح النافذة", async () => {
      const user = userEvent.setup();
      mockLoad([]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("لا توجد مصاريف مسجلة")).toBeInTheDocument(),
      );
      // زر الإضافة داخل EmptyState
      const addBtns = screen.getAllByRole("button", { name: "إضافة مصروف" });
      await user.click(addBtns[addBtns.length - 1]);
      expect(screen.getByTestId("add-expense-sheet")).toBeInTheDocument();
    });
  });

  // ── قائمة المصاريف ────────────────────────────────────────────────────────

  describe("قائمة المصاريف", () => {
    it("يعرض اسم الفئة والمبلغ والتاريخ", async () => {
      mockLoad([
        makeExpense({ category: "RENT", amount: 2500, date: "2025-01-10" }),
      ]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      // المبلغ يظهر في الملخص وفي الصف — نكتفي بالتحقق من وجوده
      expect(screen.getAllByText("2,500.00 ر.س").length).toBeGreaterThanOrEqual(1);
    });

    it("يعرض الملاحظة مع التاريخ", async () => {
      mockLoad([
        makeExpense({ note: "إيجار الربع الأول" }),
      ]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(
          screen.getByText(/إيجار الربع الأول/),
        ).toBeInTheDocument(),
      );
    });

    it("يعرض بند تكلفة المخزون المباع عند وجود COGS", async () => {
      mockLoad([], 800);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(
          screen.getByText("تكلفة المخزون المباع"),
        ).toBeInTheDocument(),
      );
      // المبلغ يظهر في الملخص وفي الصف
      expect(screen.getAllByText("800.00 ر.س").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── ملخص الإجمالي ────────────────────────────────────────────────────────

  describe("ملخص الإجمالي", () => {
    it("يعرض مجموع المصاريف الشهرية", async () => {
      mockLoad([
        makeExpense({ amount: 1000 }),
        makeExpense({ id: "2", amount: 500, category: "SALARIES" }),
      ]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText(/إجمالي مصاريف/)).toBeInTheDocument(),
      );
      expect(screen.getByText("1,500.00 ر.س")).toBeInTheDocument();
    });

    it("يُدمج COGS مع المصاريف في الإجمالي", async () => {
      mockLoad(
        [makeExpense({ amount: 1000 })],
        500,
      );
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText(/إجمالي مصاريف/)).toBeInTheDocument(),
      );
      // إجمالي = 1000 + 500 = 1500
      expect(screen.getByText("1,500.00 ر.س")).toBeInTheDocument();
    });

    it("يعرض تفصيل الفئات بالنسب المئوية عند وجود فئتين أو أكثر", async () => {
      mockLoad([
        makeExpense({ id: "1", category: "RENT",     amount: 1000 }),
        makeExpense({ id: "2", category: "SALARIES", amount: 1000 }),
      ]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getAllByText("إيجار").length).toBeGreaterThanOrEqual(1),
      );
      expect(screen.getAllByText("رواتب").length).toBeGreaterThanOrEqual(1);
      // النسبة 50 تظهر داخل span — نبحث بـ regex
      expect(screen.getAllByText(/50/).length).toBeGreaterThanOrEqual(2);
    });

    it("لا يعرض تفصيل الفئات عند وجود فئة واحدة فقط", async () => {
      mockLoad([
        makeExpense({ id: "1", amount: 500 }),
        makeExpense({ id: "2", amount: 500 }),
      ]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getAllByText("إيجار").length).toBeGreaterThan(0),
      );
      // لا نسب مئوية
      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    });
  });

  // ── حذف المصروف (نقرتان) ─────────────────────────────────────────────────

  describe("حذف المصروف", () => {
    it("النقرة الأولى تحوّل الزر إلى 'تأكيد'", async () => {
      const user = userEvent.setup();
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حذف" }));
      expect(
        screen.getByRole("button", { name: "تأكيد الحذف" }),
      ).toBeInTheDocument();
    });

    it("النقرة الثانية تستدعي API وتحذف المصروف", async () => {
      const user = userEvent.setup();
      vi.mocked(apiDelete).mockResolvedValue(undefined);
      mockLoad([makeExpense({ id: "exp-x" })]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حذف" }));
      await user.click(screen.getByRole("button", { name: "تأكيد الحذف" }));
      await waitFor(() =>
        expect(vi.mocked(apiDelete)).toHaveBeenCalledWith("/expenses/exp-x"),
      );
    });

    it("النقر خارج الصف يلغي وضع التأكيد", async () => {
      const user = userEvent.setup();
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حذف" }));
      expect(
        screen.getByRole("button", { name: "تأكيد الحذف" }),
      ).toBeInTheDocument();
      // النقر على الـ container الخارجي
      await user.click(screen.getByText("المصاريف"));
      expect(
        screen.queryByRole("button", { name: "تأكيد الحذف" }),
      ).not.toBeInTheDocument();
    });

    it("يعرض خطأ عند فشل الحذف", async () => {
      const user = userEvent.setup();
      vi.mocked(apiDelete).mockRejectedValue(new Error("fail"));
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حذف" }));
      await user.click(screen.getByRole("button", { name: "تأكيد الحذف" }));
      await waitFor(() =>
        expect(screen.getByText("تعذر حذف المصروف")).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError عند فشل الحذف", async () => {
      const { ApiError } = await import("@/lib/api");
      const user = userEvent.setup();
      vi.mocked(apiDelete).mockRejectedValue(new ApiError("مصروف غير موجود", 404));
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حذف" }));
      await user.click(screen.getByRole("button", { name: "تأكيد الحذف" }));
      await waitFor(() =>
        expect(screen.getByText("مصروف غير موجود")).toBeInTheDocument(),
      );
    });
  });

  // ── نافذة الإضافة ─────────────────────────────────────────────────────────

  describe("نافذة إضافة مصروف", () => {
    it("تفتح النافذة عند الضغط على زر الإضافة", async () => {
      const user = userEvent.setup();
      // نحمّل مصروفًا لتجنب ظهور الحالة الفارغة (التي تضيف زرًا ثانيًا)
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.queryByTestId("add-expense-sheet")).not.toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "إضافة مصروف" }));
      expect(screen.getByTestId("add-expense-sheet")).toBeInTheDocument();
    });

    it("تُغلق النافذة عند الضغط على إغلاق", async () => {
      const user = userEvent.setup();
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "إضافة مصروف" }));
      expect(screen.getByTestId("add-expense-sheet")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "إغلاق" }));
      expect(
        screen.queryByTestId("add-expense-sheet"),
      ).not.toBeInTheDocument();
    });

    it("يُعيد تحميل البيانات بعد الحفظ", async () => {
      const user = userEvent.setup();
      mockLoad([makeExpense()]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("إيجار")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "إضافة مصروف" }));
      const callsBefore = vi.mocked(apiGet).mock.calls.length;
      await user.click(screen.getByRole("button", { name: "حفظ" }));
      await waitFor(() =>
        expect(vi.mocked(apiGet).mock.calls.length).toBeGreaterThan(callsBefore),
      );
    });
  });

  // ── التنقل بين الأشهر ────────────────────────────────────────────────────

  describe("التنقل بين الأشهر", () => {
    it("الضغط على الشهر السابق يجلب بيانات الشهر الصحيح", async () => {
      const user = userEvent.setup();
      vi.mocked(currentMonthStr).mockReturnValue("2026-05");
      mockLoad([]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("لا توجد مصاريف مسجلة")).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole("button", { name: "الشهر السابق" }),
      );
      await waitFor(() =>
        expect(vi.mocked(apiGet)).toHaveBeenCalledWith(
          expect.stringMatching(/month=2026-04/),
        ),
      );
    });

    it("الرجوع للشهر الحالي يعطّل زر الشهر التالي", async () => {
      const user = userEvent.setup();
      mockLoad([]);
      render(<ExpensesPage />);
      await waitFor(() =>
        expect(screen.getByText("لا توجد مصاريف مسجلة")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "الشهر السابق" }));
      await user.click(screen.getByRole("button", { name: "الشهر التالي" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "الشهر التالي" }),
        ).toBeDisabled(),
      );
    });
  });
});
