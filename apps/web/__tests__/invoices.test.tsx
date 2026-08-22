import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Invoice } from "@/lib/types";

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

// مكوّنات مساعدة — نُبقيها بسيطة لتجنب تبعياتها
vi.mock("@/components/StatusBadge", () => ({
  default: ({ status }: { status: string }) => (
    <span data-testid="status-badge">{status}</span>
  ),
}));

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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import InvoicesPage from "@/app/(app)/invoices/page";
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

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    number: "INV-001",
    customer: { id: "c1", name: "أم خالد" },
    items: [],
    subtotal: 500,
    vatAmount: 0,
    total: 500,
    status: "UNPAID",
    paidAmount: null,
    issueDate: "2025-01-15",
    dueDate: null,
    notes: null,
    createdAt: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة الفواتير (Invoices)", () => {
  beforeEach(() => {
    vi.mocked(currentMonthStr).mockReturnValue(nextFakeMonth());
    vi.mocked(apiGet).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── العرض الأولي ─────────────────────────────────────────────────────────

  describe("العرض الأولي", () => {
    it("يعرض العنوان وزر الإضافة وتبويبات الفلتر", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<InvoicesPage />);
      expect(screen.getByText("الفواتير")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "إضافة فاتورة" }),
      ).toHaveAttribute("href", "/invoices/new");
      expect(screen.getByRole("button", { name: "الكل" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "غير مدفوعة" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "جزئي" })).toBeInTheDocument();
    });
  });

  // ── حالة التحميل ─────────────────────────────────────────────────────────

  describe("حالة التحميل", () => {
    it("يعرض هيكل عظمي أثناء جلب البيانات", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<InvoicesPage />);
      // Skeleton يُعرض عندما invoices=null وlا يوجد خطأ
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  // ── حالة الخطأ ───────────────────────────────────────────────────────────

  describe("حالة الخطأ", () => {
    it("يعرض رسالة الخطأ عند فشل الطلب", async () => {
      vi.mocked(apiGet).mockRejectedValue(new Error("network"));
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(
          screen.getByText("تعذر تحميل الفواتير"),
        ).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError كما هي", async () => {
      const { ApiError } = await import("@/lib/api");
      vi.mocked(apiGet).mockRejectedValue(
        new ApiError("خادم غير متاح", 503),
      );
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("خادم غير متاح")).toBeInTheDocument(),
      );
    });
  });

  // ── قائمة الفواتير ────────────────────────────────────────────────────────

  describe("قائمة الفواتير", () => {
    it("يعرض اسم الزبون ورقم الفاتورة والمبلغ", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ customer: { id: "c1", name: "أم خالد" }, total: 800, number: "INV-001" }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      expect(screen.getByText(/INV-001/)).toBeInTheDocument();
      // المبلغ يظهر في صف الفاتورة — نتحقق عبر الـ aria-label
      expect(
        screen.getByRole("link", { name: /800\.00/ }),
      ).toBeInTheDocument();
    });

    it("يعرض 'بدون زبون' للفواتير بدون اسم زبون", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ customer: null }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("بدون زبون")).toBeInTheDocument(),
      );
    });

    it("الفاتورة ترتبط بصفحة التفاصيل الصحيحة", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ id: "inv-abc" }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: /فاتورة INV-001/ }),
        ).toHaveAttribute("href", "/invoices/inv-abc"),
      );
    });

    it("يعرض المتبقي للفاتورة الجزئية", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ status: "PARTIAL", total: 1000, paidAmount: 400 }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      // "متبقي X ر.س" يُعرض في صف الفاتورة الجزئية
      expect(screen.getByText(/متبقي/)).toBeInTheDocument();
    });
  });

  // ── الحالة الفارغة ────────────────────────────────────────────────────────

  describe("الحالة الفارغة", () => {
    it("يعرض رسالة لا فواتير عند قائمة فارغة", async () => {
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText(/ما في فواتير في/)).toBeInTheDocument(),
      );
    });

    it("يعرض رابط إضافة فاتورة في الحالة الفارغة", async () => {
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(
          screen.getByRole("link", { name: "إضافة فاتورة" }),
        ).toBeInTheDocument(),
      );
    });
  });

  // ── تبويبات الفلتر ────────────────────────────────────────────────────────

  describe("تبويبات الفلتر", () => {
    const invoices = [
      makeInvoice({ id: "1", customer: { id: "c1", name: "أم خالد" }, status: "UNPAID",  total: 500 }),
      makeInvoice({ id: "2", customer: { id: "c2", name: "أم فهد"  }, status: "PARTIAL", total: 300, paidAmount: 100, number: "INV-002" }),
      makeInvoice({ id: "3", customer: { id: "c3", name: "أم سعد"  }, status: "PAID",    total: 200, number: "INV-003" }),
    ];

    it("تبويب 'الكل' يعرض جميع الفواتير", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet).mockResolvedValue(invoices);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "الكل" }));
      expect(screen.getByText("أم خالد")).toBeInTheDocument();
      expect(screen.getByText("أم فهد")).toBeInTheDocument();
      expect(screen.getByText("أم سعد")).toBeInTheDocument();
    });

    it("تبويب 'غير مدفوعة' يخفي المدفوعة والجزئية", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet).mockResolvedValue(invoices);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "غير مدفوعة" }));
      expect(screen.getByText("أم خالد")).toBeInTheDocument();
      expect(screen.queryByText("أم فهد")).not.toBeInTheDocument();
      expect(screen.queryByText("أم سعد")).not.toBeInTheDocument();
    });

    it("تبويب 'جزئي' يعرض الفواتير الجزئية فقط", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet).mockResolvedValue(invoices);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "جزئي" }));
      expect(screen.queryByText("أم خالد")).not.toBeInTheDocument();
      expect(screen.getByText("أم فهد")).toBeInTheDocument();
      expect(screen.queryByText("أم سعد")).not.toBeInTheDocument();
    });

    it("يعرض رسالة 'لا فواتير' عند تصفية بدون نتائج", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ status: "PAID" }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "غير مدفوعة" }));
      expect(
        screen.getByText("لا توجد فواتير بهذا الفلتر"),
      ).toBeInTheDocument();
    });
  });

  // ── الملخص الشهري ────────────────────────────────────────────────────────

  describe("الملخص الشهري", () => {
    it("يعرض إجمالي عدد الفواتير ومجموعها", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ status: "PAID", total: 500 }),
        makeInvoice({ id: "2", status: "PAID", total: 300, number: "INV-002" }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("إجمالي 2 فاتورة")).toBeInTheDocument(),
      );
      // كلا الفاتورتين مدفوعتان → لا "غير محصّل" → مجموع واحد فقط
      expect(screen.getByText("800.00 ر.س")).toBeInTheDocument();
    });

    it("يعرض المبالغ غير المحصّلة من الزباين", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ status: "UNPAID", total: 500 }),
        makeInvoice({ id: "2", status: "PARTIAL", total: 300, paidAmount: 100, number: "INV-002" }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("غير محصّل من الزباين")).toBeInTheDocument(),
      );
      // outstanding = 500 (UNPAID) + (300-100) (PARTIAL) = 700
      expect(screen.getByText("700.00 ر.س")).toBeInTheDocument();
    });

    it("لا يظهر قسم 'غير محصّل' عند دفع جميع الفواتير", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeInvoice({ status: "PAID", total: 500 }),
      ]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.getByText("أم خالد")).toBeInTheDocument(),
      );
      expect(
        screen.queryByText("غير محصّل من الزباين"),
      ).not.toBeInTheDocument();
    });
  });

  // ── التنقل بين الأشهر ────────────────────────────────────────────────────

  describe("التنقل بين الأشهر", () => {
    it("زر الشهر التالي معطّل عند الشهر الحالي", async () => {
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.queryByRole("status")).not.toBeInTheDocument(),
      );
      expect(
        screen.getByRole("button", { name: "الشهر التالي" }),
      ).toBeDisabled();
    });

    it("الضغط على الشهر السابق يجلب بيانات الشهر السابق", async () => {
      const user = userEvent.setup();
      vi.mocked(currentMonthStr).mockReturnValue("2026-07");
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.queryByRole("status")).not.toBeInTheDocument(),
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

    it("الرجوع للشهر الحالي يعطّل زر الشهر التالي", async () => {
      const user = userEvent.setup();
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(screen.queryByRole("status")).not.toBeInTheDocument(),
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

  // ── بانر الفاتورة الجديدة ─────────────────────────────────────────────────

  describe("بانر 'تم الحفظ'", () => {
    it("يظهر البانر الأخضر عند وجود ?created=1 في URL", async () => {
      // jsdom لا يُعيّن window.location تلقائياً — نحاكيه يدوياً
      Object.defineProperty(window, "location", {
        value: { search: "?created=1" },
        writable: true,
      });
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        expect(
          screen.getByText("تم حفظ الفاتورة وتحديث المخزون مباشرة"),
        ).toBeInTheDocument(),
      );
      // إعادة التهيئة
      Object.defineProperty(window, "location", {
        value: { search: "" },
        writable: true,
      });
    });

    it("لا يظهر البانر بدون ?created=1", async () => {
      Object.defineProperty(window, "location", {
        value: { search: "" },
        writable: true,
      });
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<InvoicesPage />);
      await waitFor(() =>
        // نتحقق بعد تحميل البيانات
        expect(vi.mocked(apiGet)).toHaveBeenCalled(),
      );
      expect(
        screen.queryByText("تم حفظ الفاتورة وتحديث المخزون مباشرة"),
      ).not.toBeInTheDocument();
    });
  });
});
