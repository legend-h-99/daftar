import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DashboardSummary, UnpaidInvoiceSummary } from "@/lib/types";

// ── Static mocks (hoisted by Vitest before imports) ──────────────────────────

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Render the final value immediately — skips RAF animation in jsdom
vi.mock("@/components/ui/animated-counter", () => ({
  AnimatedCounter: ({
    to,
    format,
    className,
  }: {
    to: number;
    format: (n: number) => string;
    className?: string;
  }) => <span className={className}>{format(to)}</span>,
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

// Mock currentMonthStr so each test gets a unique month → no summaryCache collisions
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, currentMonthStr: vi.fn() };
});

// ── Imports (after mocks) ────────────────────────────────────────────────────

import DashboardPage from "@/app/(app)/dashboard/page";
import { apiGet } from "@/lib/api";
import { currentMonthStr } from "@/lib/format";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Each test gets a unique month string so the module-level summaryCache never
// returns a hit from a previous test.
let monthCounter = 0;

function nextFakeMonth(): string {
  monthCounter++;
  const y = 2000 + Math.floor((monthCounter - 1) / 12);
  const m = String(((monthCounter - 1) % 12) + 1).padStart(2, "0");
  return `${y}-${m}`;
}

beforeEach(() => {
  vi.mocked(currentMonthStr).mockReturnValue(nextFakeMonth());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    totalSales: 5_000,
    totalPurchases: 2_000,
    costOfGoodsSold: 1_500,
    operatingExpenses: 500,
    totalExpenses: 500,
    netProfit: 2_500,
    unpaidInvoices: [],
    unpaidInvoicesCount: 0,
    unpaidInvoicesTotal: 0,
    unpaidInvoicesLimitedTo: 5,
    lowStock: [],
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<UnpaidInvoiceSummary> = {}): UnpaidInvoiceSummary {
  return {
    id: "inv-1",
    number: "INV-001",
    customerName: "أم خالد",
    total: 800,
    status: "UNPAID",
    dueDate: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("صفحة الرئيسية (Dashboard)", () => {
  describe("حالة التحميل", () => {
    it("يظهر الهيكل العظمي أثناء جلب البيانات", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {})); // never resolves
      render(<DashboardPage />);
      expect(
        screen.getByRole("status", { name: /جاري تحميل/ }),
      ).toBeInTheDocument();
    });

    it("يختفي الهيكل العظمي بعد تحميل البيانات", async () => {
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);
      await waitFor(() =>
        expect(
          screen.queryByRole("status", { name: /جاري تحميل/ }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe("بطاقات الإحصاء", () => {
    it("يعرض المبيعات والمشتريات والمصاريف وصافي الربح", async () => {
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );
      expect(screen.getByText("تكلفة البيع")).toBeInTheDocument();
      expect(screen.getByText("مصاريف")).toBeInTheDocument();
      expect(screen.getByText(/صافي الربح/)).toBeInTheDocument();
    });

    it("يعرض الأرقام المنسّقة بالريال السعودي", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({ totalSales: 5_000, netProfit: 2_500 }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("5,000.00 ر.س")).toBeInTheDocument(),
      );
      expect(screen.getByText("2,500.00 ر.س")).toBeInTheDocument();
    });

    it("يعرض صافي الربح السالب", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({ netProfit: -1_200 }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("-1,200.00 ر.س")).toBeInTheDocument(),
      );
    });
  });

  describe("حالة الخطأ", () => {
    it("يظهر رسالة الخطأ وزر إعادة المحاولة عند فشل الطلب", async () => {
      vi.mocked(apiGet).mockRejectedValue(new Error("network error"));
      render(<DashboardPage />);

      await waitFor(() =>
        expect(
          screen.getByText("تعذر تحميل البيانات"),
        ).toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: /حاول مرة ثانية/ }),
      ).toBeInTheDocument();
    });

    it("يعيد جلب البيانات عند الضغط على إعادة المحاولة", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet)
        .mockRejectedValueOnce(new Error("first fail"))
        .mockResolvedValueOnce(makeSummary());

      render(<DashboardPage />);

      const retryBtn = await screen.findByRole("button", {
        name: /حاول مرة ثانية/,
      });
      await user.click(retryBtn);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );
    });
  });

  describe("التنقل بين الأشهر", () => {
    it("زر الشهر التالي معطّل عند الشهر الحالي", async () => {
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: "الشهر التالي" }),
      ).toBeDisabled();
    });

    it("زر الشهر السابق مفعّل دائمًا", async () => {
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: "الشهر السابق" }),
      ).not.toBeDisabled();
    });

    it("الضغط على الشهر السابق يجلب بيانات الشهر الصحيح", async () => {
      const user = userEvent.setup();
      // Use a fixed known month for precise assertion
      vi.mocked(currentMonthStr).mockReturnValue("2026-07");
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );
      await user.click(
        screen.getByRole("button", { name: "الشهر السابق" }),
      );

      await waitFor(() =>
        expect(vi.mocked(apiGet)).toHaveBeenCalledWith(
          expect.stringMatching(/month=2026-06/),
        ),
      );
    });

    it("الرجوع للشهر الحالي يعطّل زر الشهر التالي مجددًا", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );

      await user.click(
        screen.getByRole("button", { name: "الشهر السابق" }),
      );
      await user.click(
        screen.getByRole("button", { name: "الشهر التالي" }),
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "الشهر التالي" }),
        ).toBeDisabled(),
      );
    });
  });

  describe("الفواتير غير المدفوعة", () => {
    it("يعرض رسالة 'لا فواتير' عند عدم وجود فواتير معلّقة", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({ unpaidInvoices: [] }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(
          screen.getByText("ولا فاتورة غير مدفوعة"),
        ).toBeInTheDocument(),
      );
    });

    it("يعرض قائمة الفواتير مع أسماء الزباين والمبالغ", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          unpaidInvoices: [
            makeInvoice({ customerName: "أم خالد", total: 800 }),
            makeInvoice({
              id: "inv-2",
              number: "INV-002",
              customerName: "أم فهد",
              total: 350,
              status: "PARTIAL",
            }),
          ],
          unpaidInvoicesCount: 2,
          unpaidInvoicesTotal: 1_150,
        }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      expect(screen.getByText("أم فهد")).toBeInTheDocument();
      expect(screen.getByText("800.00 ر.س")).toBeInTheDocument();
    });

    it("يعرض 'زبون بدون اسم' للفواتير بدون اسم زبون", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          unpaidInvoices: [makeInvoice({ customerName: null })],
          unpaidInvoicesCount: 1,
        }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("زبون بدون اسم")).toBeInTheDocument(),
      );
    });

    it("يظهر رابط 'عرض جميع الفواتير' عندما يتجاوز العدد الحد", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          unpaidInvoices: [makeInvoice()],
          unpaidInvoicesCount: 10,
          unpaidInvoicesLimitedTo: 5,
        }),
      );
      render(<DashboardPage />);

      await waitFor(() => {
        const link = screen.getByRole("link", {
          name: /عرض جميع الفواتير.*10/,
        });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute("href", "/invoices");
      });
    });

    it("لا يظهر رابط 'عرض جميع' عندما يكون العدد ضمن الحد", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          unpaidInvoices: [makeInvoice()],
          unpaidInvoicesCount: 3,
          unpaidInvoicesLimitedTo: 5,
        }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      expect(
        screen.queryByRole("link", { name: /عرض جميع الفواتير/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("تنبيه المخزون المنخفض", () => {
    it("يظهر التنبيه مع أسماء المواد عند وجود مخزون منخفض", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          lowStock: [
            { id: "m1", name: "دقيق", unit: "KG", stockQty: 0.5, reorderLevel: 5 },
            { id: "m2", name: "سكر", unit: "KG", stockQty: 1, reorderLevel: 3 },
          ],
        }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText(/مخزون منخفض/)).toBeInTheDocument(),
      );
      expect(screen.getByText(/دقيق/)).toBeInTheDocument();
      expect(screen.getByText(/سكر/)).toBeInTheDocument();
    });

    it("لا يظهر التنبيه عند كفاية المخزون", async () => {
      vi.mocked(apiGet).mockResolvedValue(makeSummary({ lowStock: [] }));
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText("المبيعات")).toBeInTheDocument(),
      );
      expect(screen.queryByText(/مخزون منخفض/)).not.toBeInTheDocument();
    });

    it("التنبيه يشير لصفحة المخزون", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          lowStock: [
            { id: "m1", name: "دقيق", unit: "KG", stockQty: 0.5, reorderLevel: 5 },
          ],
        }),
      );
      render(<DashboardPage />);

      await waitFor(() => {
        const link = screen.getByRole("link", { name: /مخزون منخفض/ });
        expect(link).toHaveAttribute("href", "/inventory");
      });
    });

    it("يعرض حتى 3 مواد فقط مع عداد 'وN أصناف أخرى'", async () => {
      vi.mocked(apiGet).mockResolvedValue(
        makeSummary({
          lowStock: [
            { id: "m1", name: "دقيق", unit: "KG", stockQty: 0.5, reorderLevel: 5 },
            { id: "m2", name: "سكر", unit: "KG", stockQty: 1, reorderLevel: 3 },
            { id: "m3", name: "ملح", unit: "KG", stockQty: 0.2, reorderLevel: 2 },
            { id: "m4", name: "فلفل", unit: "GRAM", stockQty: 10, reorderLevel: 100 },
          ],
        }),
      );
      render(<DashboardPage />);

      await waitFor(() =>
        expect(screen.getByText(/مخزون منخفض/)).toBeInTheDocument(),
      );
      expect(screen.getByText(/و1 أصناف أخرى/)).toBeInTheDocument();
    });
  });

  describe("رابط التقارير", () => {
    it("يظهر رابط التقارير في الهيدر", async () => {
      vi.mocked(apiGet).mockResolvedValue(makeSummary());
      render(<DashboardPage />);

      const link = screen.getByRole("link", { name: /عرض التقرير الكامل/ });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/reports");
    });
  });
});
