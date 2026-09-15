import { render, screen, waitFor } from "@/test/test-utils";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Product } from "@/lib/types";

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

import ProductsPage from "@/app/(app)/products/page";
import { apiGet } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "كيكة شوكولاتة",
    category: null,
    profitMargin: 40,
    overheadCost: null,
    recipeItems: [],
    rawCost: 30,
    packagingCost: 5,
    totalCost: 35,
    sellingPrice: 60,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة المنتجات (Products)", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── حالة التحميل ─────────────────────────────────────────────────────────

  describe("حالة التحميل", () => {
    it("يعرض هيكل عظمي أثناء جلب البيانات", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<ProductsPage />);
      expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });
  });

  // ── حالة الخطأ ───────────────────────────────────────────────────────────

  describe("حالة الخطأ", () => {
    it("يعرض رسالة الخطأ الافتراضية عند فشل الطلب", async () => {
      vi.mocked(apiGet).mockRejectedValue(new Error("network"));
      render(<ProductsPage />);
      await waitFor(() =>
        expect(screen.getByText("تعذر تحميل المنتجات")).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError كما هي", async () => {
      const { ApiError } = await import("@/lib/api");
      vi.mocked(apiGet).mockRejectedValue(new ApiError("خطأ في الخادم", 500));
      render(<ProductsPage />);
      await waitFor(() =>
        expect(screen.getByText("خطأ في الخادم")).toBeInTheDocument(),
      );
    });
  });

  // ── الحالة الفارغة ────────────────────────────────────────────────────────

  describe("الحالة الفارغة", () => {
    it("يعرض رسالة لا منتجات عند القائمة الفارغة", async () => {
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<ProductsPage />);
      await waitFor(() =>
        expect(screen.getByText("لسه ما أضفت أي منتج")).toBeInTheDocument(),
      );
    });
  });

  // ── قائمة المنتجات ────────────────────────────────────────────────────────

  describe("قائمة المنتجات", () => {
    it("يعرض اسم المنتج وسعر البيع وسعر التكلفة", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeProduct({
          name: "كيكة شوكولاتة",
          sellingPrice: 60,
          totalCost: 35,
        }),
      ]);
      render(<ProductsPage />);
      await waitFor(() =>
        expect(screen.getByText("كيكة شوكولاتة")).toBeInTheDocument(),
      );
      // سعر البيع
      expect(screen.getByText(/60\.00/)).toBeInTheDocument();
      // سعر التكلفة
      expect(screen.getByText(/35\.00/)).toBeInTheDocument();
    });

    it("يعرض أسماء منتجات متعددة", async () => {
      vi.mocked(apiGet).mockResolvedValue([
        makeProduct({ id: "p1", name: "كيكة شوكولاتة" }),
        makeProduct({ id: "p2", name: "حلوى جوز" }),
      ]);
      render(<ProductsPage />);
      await waitFor(() =>
        expect(screen.getByText("كيكة شوكولاتة")).toBeInTheDocument(),
      );
      expect(screen.getByText("حلوى جوز")).toBeInTheDocument();
    });
  });

  // ── زر الإضافة ───────────────────────────────────────────────────────────

  describe("زر إضافة منتج", () => {
    it("يظهر زر إضافة منتج في رأس الصفحة", () => {
      vi.mocked(apiGet).mockReturnValue(new Promise(() => {}));
      render(<ProductsPage />);
      expect(
        screen.getByRole("link", { name: "إضافة منتج" }),
      ).toHaveAttribute("href", "/products/new");
    });

    it("يظهر زر إضافة منتج في الحالة الفارغة أيضًا", async () => {
      vi.mocked(apiGet).mockResolvedValue([]);
      render(<ProductsPage />);
      await waitFor(() =>
        expect(screen.getByText("لسه ما أضفت أي منتج")).toBeInTheDocument(),
      );
      // رابط الإضافة يظهر في الرأس وفي EmptyState — نتحقق من وجود اثنين على الأقل
      expect(
        screen.getAllByRole("link", { name: "إضافة منتج" }).length,
      ).toBeGreaterThanOrEqual(2);
    });
  });
});
