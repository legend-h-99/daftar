import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardSummary, Expense, Invoice, Purchase } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/demo-api", () => ({ DEMO_MODE: false, DEMO_TOKEN: "demo", demoApiFetch: vi.fn() }));

vi.mock("@/lib/business-context", () => ({
  useBusiness: () => ({ business: { id: "b", name: "مطبخ نورة", vatEnabled: false } }),
}));

vi.mock("@/lib/format", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/format")>()),
  currentMonthStr: () => "2026-10",
}));

vi.mock("@/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/csv")>()),
  downloadCsv: vi.fn(),
}));

import InvoicesPage from "@/app/(app)/invoices/page";
import ExpensesPage from "@/app/(app)/expenses/page";
import PurchasesPage from "@/app/(app)/purchases/page";
import ReportsPage from "@/app/(app)/reports/page";
import { apiGet } from "@/lib/api";
import { downloadCsv } from "@/lib/csv";

const EXPORT = "تصدير إكسل (CSV)";
const PRINT = "طباعة / حفظ PDF";

const paid: Invoice = { id: "i1", number: "1", items: [], subtotal: 100, vatAmount: 0, total: 100, status: "PAID", issueDate: "2026-10-01" };
const unpaid: Invoice = { ...paid, id: "i2", number: "2", status: "UNPAID", total: 50, subtotal: 50 };
const expense: Expense = { id: "e1", category: "RENT", amount: 300, date: "2026-10-01" };
const purchase: Purchase = { id: "p1", number: 1, date: "2026-10-02", total: 90, source: "MANUAL", items: [] };
const summary = {
  totalSales: 1000, totalPurchases: 0, costOfGoodsSold: 120, operatingExpenses: 300, totalExpenses: 420, netProfit: 580,
  cashFlow: null, unpaidInvoices: [], unpaidInvoicesCount: 0, unpaidInvoicesTotal: 0, unpaidInvoicesLimitedTo: 5, lowStock: [],
} as DashboardSummary;

function mockApi() {
  vi.mocked(apiGet).mockImplementation(async (path: string) => {
    if (path.startsWith("/invoices")) return [paid, unpaid];
    if (path.startsWith("/expenses")) return [expense];
    if (path === "/purchases/summary") return { bySupplier: [], byMonth: [] };
    if (path.startsWith("/purchases")) return [purchase];
    if (path.startsWith("/dashboard/summary")) return summary;
    throw new Error(`unexpected ${path}`);
  });
}

const exported = () => vi.mocked(downloadCsv).mock.calls[0] as [string, string];

beforeEach(() => {
  vi.mocked(downloadCsv).mockReset();
  mockApi();
});

afterEach(() => vi.restoreAllMocks());

describe("month exports", () => {
  it("exports all of the month's invoices", async () => {
    render(<InvoicesPage />);
    await userEvent.click(await screen.findByRole("button", { name: EXPORT }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
    const [filename, csv] = exported();
    expect(filename).toBe("فواتير-2026-10.csv");
    expect(csv).toContain("مدفوعة");
    expect(csv).toContain("غير مدفوعة");
  });

  it("limits the invoice export to the selected status and says so in the file name", async () => {
    render(<InvoicesPage />);
    await screen.findByRole("button", { name: EXPORT });
    await userEvent.click(screen.getByRole("button", { name: "غير مدفوعة" }));
    await userEvent.click(screen.getByRole("button", { name: EXPORT }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
    const [filename, csv] = exported();
    expect(filename).toBe("فواتير-غير-مدفوعة-2026-10.csv");
    expect(csv.trimEnd().split("\r\n")).toHaveLength(2);
    expect(csv).toContain("2,2026-10-01");
  });

  it("exports expenses with the cost of goods sold shown on screen", async () => {
    render(<ExpensesPage />);
    await userEvent.click(await screen.findByRole("button", { name: EXPORT }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
    const [filename, csv] = exported();
    expect(filename).toBe("مصاريف-2026-10.csv");
    expect(csv).toContain("تكلفة المخزون المباع,120");
    expect(csv).toContain("2026-10-01,إيجار,300");
  });

  it("exports purchases", async () => {
    render(<PurchasesPage />);
    await userEvent.click(await screen.findByRole("button", { name: EXPORT }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
    const [filename, csv] = exported();
    expect(filename).toBe("مشتريات-2026-10.csv");
    expect(csv).toContain("1,2026-10-02,,,90,");
  });

  it("offers no export when the month is empty", async () => {
    vi.mocked(apiGet).mockResolvedValue([]);
    render(<InvoicesPage />);
    await screen.findByText(/ما في فواتير/);
    expect(screen.queryByRole("button", { name: EXPORT })).not.toBeInTheDocument();
  });

  it("shows an error and downloads nothing when a request fails, then can retry", async () => {
    render(<InvoicesPage />);
    const button = await screen.findByRole("button", { name: EXPORT });
    vi.mocked(apiGet).mockRejectedValueOnce(new Error("down"));
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("تعذر تصدير الملف");
    expect(downloadCsv).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: EXPORT }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/تعذر تصدير الملف/)).not.toBeInTheDocument();
  });
});

describe("report printing", () => {
  it("names the saved PDF after the month and restores the page title", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {
      expect(document.title).toBe("تقرير دفتر 2026-10");
    });
    document.title = "دفتر";
    render(<ReportsPage />);
    await userEvent.click(await screen.findByRole("button", { name: PRINT }));
    expect(print).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("afterprint"));
    expect(document.title).toBe("دفتر");
  });

  it("carries the business name and month on paper", async () => {
    render(<ReportsPage />);
    await screen.findByRole("button", { name: PRINT });
    expect(screen.getByText("مطبخ نورة")).toHaveClass("text-lg");
    expect(screen.getByText(/التقرير الشهري/).parentElement).toHaveClass("hidden", "print:block");
  });

  it("offers no print button until the report has loaded", async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error("down"));
    render(<ReportsPage />);
    await screen.findByRole("button", { name: "حاول مرة ثانية" });
    expect(screen.queryByRole("button", { name: PRINT })).not.toBeInTheDocument();
  });
});
