import { render, screen, waitFor } from "@/test/test-utils";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Purchase, PurchasesSummary } from "@/lib/types";

// ── Static mocks ─────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

vi.mock("@/lib/demo-api", () => ({
  DEMO_MODE: false,
  DEMO_TOKEN: "demo-token-daftar",
  demoApiFetch: vi.fn(),
}));

// currentMonthStr ثابت لكل اختبار
vi.mock("@/lib/format", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/format")>();
  return { ...actual, currentMonthStr: vi.fn() };
});

vi.mock("@/components/EmptyState", () => ({
  default: ({ title, actionLabel, actionHref }: {
    title: string;
    actionLabel?: string;
    actionHref?: string;
  }) => (
    <div>
      <p>{title}</p>
      {actionLabel && actionHref && <a href={actionHref}>{actionLabel}</a>}
    </div>
  ),
}));

// نحاكي MonthNav لتجنب تبعياتها مع الإبقاء على أزرار التنقل
vi.mock("@/components/ui/month-nav", () => ({
  MonthNav: ({
    isCurrentMonth,
    onPrev,
    onNext,
  }: {
    month: string;
    isCurrentMonth: boolean;
    onPrev: () => void;
    onNext: () => void;
    className?: string;
  }) => (
    <div>
      <button onClick={onPrev} aria-label="الشهر السابق">السابق</button>
      <button onClick={onNext} disabled={isCurrentMonth} aria-label="الشهر التالي">التالي</button>
    </div>
  ),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import PurchasesPage from "@/app/(app)/purchases/page";
import { apiGet } from "@/lib/api";
import { currentMonthStr } from "@/lib/format";

// ── Helpers ──────────────────────────────────────────────────────────────────

let monthCounter = 0;
function nextFakeMonth(): string {
  monthCounter++;
  const y = 2000 + Math.floor((monthCounter - 1) / 12);
  const m = String(((monthCounter - 1) % 12) + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: "pur-1",
    number: 1,
    supplier: { id: "s1", name: "مورد الخير" },
    date: "2025-01-10",
    total: 1500,
    notes: null,
    source: "MANUAL",
    items: [],
    ...overrides,
  };
}

function makeSummary(bySupplier: PurchasesSummary["bySupplier"] = []): PurchasesSummary {
  return { bySupplier, byMonth: [] };
}

/** يُهيئ apiGet ليرد بقائمة مشتريات وملخص اختياري */
function mockLoad(purchases: Purchase[], summary: PurchasesSummary | null = null) {
  vi.mocked(apiGet).mockImplementation(async (path: string) => {
    if (path.includes("/purchases/summary")) {
      if (summary) return summary;
      throw new Error("no summary");
    }
    if (path.includes("/purchases")) return purchases;
    return null;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة المشتريات (Purchases)", () => {
  beforeEach(() => {
    vi.mocked(currentMonthStr).mockReturnValue(nextFakeMonth());
    vi.mocked(apiGet).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── حالة التحميل ─────────────────────────────────────────────────────────

  describe("حالة التحميل", () => {
    it("يعرض هيكل عظمي أثناء جلب البيانات", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<PurchasesPage />);
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  // ── حالة الخطأ ───────────────────────────────────────────────────────────

  describe("حالة الخطأ", () => {
    it("يعرض رسالة الخطأ الافتراضية عند فشل الطلب", async () => {
      vi.mocked(apiGet).mockRejectedValue(new Error("network"));
      render(<PurchasesPage />);
      await waitFor(() =>
        expect(screen.getByText("تعذر تحميل المشتريات")).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError كما هي", async () => {
      const { ApiError } = await import("@/lib/api");
      vi.mocked(apiGet).mockRejectedValue(
        new ApiError("خادم غير متاح", 503),
      );
      render(<PurchasesPage />);
      await waitFor(() =>
        expect(screen.getByText("خادم غير متاح")).toBeInTheDocument(),
      );
    });
  });

  // ── الحالة الفارغة ────────────────────────────────────────────────────────

  describe("الحالة الفارغة", () => {
    it("يعرض رسالة لا مشتريات عند القائمة الفارغة", async () => {
      mockLoad([]);
      render(<PurchasesPage />);
      await waitFor(() =>
        expect(screen.getByText(/ما في مشتريات في/)).toBeInTheDocument(),
      );
    });
  });

  // ── قائمة المشتريات ───────────────────────────────────────────────────────

  describe("قائمة المشتريات", () => {
    it("يعرض اسم المورد ورقم الشراء والإجمالي والتاريخ", async () => {
      mockLoad([
        makePurchase({
          number: 7,
          supplier: { id: "s1", name: "مستودع النور" },
          total: 2300,
          date: "2025-03-05",
        }),
      ]);
      render(<PurchasesPage />);
      await waitFor(() =>
        expect(screen.getByText("مستودع النور")).toBeInTheDocument(),
      );
      // الإجمالي يظهر في الصف وفي الملخص — نتحقق عبر getAllByText
      expect(screen.getAllByText(/2,300\.00/).length).toBeGreaterThanOrEqual(1);
      // التاريخ يظهر في الصف
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });

    it("يعرض 'بدون مورد' عندما يكون المورد null", async () => {
      mockLoad([makePurchase({ supplier: null })]);
      render(<PurchasesPage />);
      await waitFor(() =>
        expect(screen.getByText("بدون مورد")).toBeInTheDocument(),
      );
    });
  });

  // ── التنقل بين الأشهر ────────────────────────────────────────────────────

  describe("التنقل بين الأشهر", () => {
    it("زر الشهر التالي معطّل عند الشهر الحالي", async () => {
      mockLoad([]);
      render(<PurchasesPage />);
      await waitFor(() =>
        expect(screen.queryByRole("status")).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: "الشهر التالي" }),
      ).toBeDisabled();
    });
  });
});
