import { render, screen } from "@/test/test-utils";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

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
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

vi.mock("@/lib/business-context", () => ({
  useBusiness: () => ({ business: { id: "b", name: "مطبخ نورة", vatEnabled: false } }),
}));

import InvoiceDetailClient from "@/app/(app)/invoices/[id]/InvoiceDetailClient";
import { apiGet } from "@/lib/api";
import { formatSAR } from "@/lib/format";
import { buildPaymentReminder } from "@/lib/invoice-reminder";

const baseInvoice = {
  id: "inv1",
  number: 12,
  status: "PARTIAL",
  total: 300,
  subtotal: 300,
  vatAmount: 0,
  paidAmount: 100,
  items: [],
  customer: { id: "c1", name: "أم ليلى", phone: "0501234567" },
};

async function findReminderLink() {
  return screen.findByRole("link", { name: "تذكير ودّي عبر واتساب" });
}

describe("رسالة التذكير الودية", () => {
  beforeEach(() => vi.mocked(apiGet).mockReset());

  it("تذكر الاسم والفاتورة والمحل والمتبقي بلا كلمة حالة رسمية", () => {
    const text = buildPaymentReminder({
      language: "ar",
      customerName: "أم ليلى",
      invoiceNumber: 12,
      businessName: "مطبخ نورة",
      remaining: 200,
    });
    expect(text).toContain("السلام عليكم أم ليلى،");
    expect(text).toContain("فاتورة رقم 12 من مطبخ نورة");
    expect(text).toContain(formatSAR(200));
    expect(text).not.toContain("الحالة");
  });

  it("تعمل بدون اسم زبون", () => {
    const text = buildPaymentReminder({
      language: "ar",
      customerName: null,
      invoiceNumber: 12,
      businessName: "مطبخ نورة",
      remaining: 200,
    });
    expect(text.split("\n")[0]).toBe("السلام عليكم،");
  });

  it("يفتح الزر واتساب برقم الزبون والمبلغ المتبقي", async () => {
    vi.mocked(apiGet).mockResolvedValue(baseInvoice);
    render(<InvoiceDetailClient invoiceId="inv1" />);
    const href = (await findReminderLink()).getAttribute("href") ?? "";
    expect(href.startsWith("https://wa.me/966501234567?text=")).toBe(true);
    const text = decodeURIComponent(href.split("?text=")[1]);
    expect(text).toContain("أم ليلى");
    expect(text).toContain(formatSAR(200));
  });

  it("لا يظهر الزر للفاتورة المدفوعة", async () => {
    vi.mocked(apiGet).mockResolvedValue({ ...baseInvoice, status: "PAID", paidAmount: 300 });
    render(<InvoiceDetailClient invoiceId="inv1" />);
    await screen.findByRole("link", { name: "مشاركة عبر واتساب" });
    expect(screen.queryByRole("link", { name: "تذكير ودّي عبر واتساب" })).not.toBeInTheDocument();
  });
});
