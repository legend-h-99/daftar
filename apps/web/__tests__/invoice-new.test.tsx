import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }) }));
vi.mock("@/lib/business-context", () => ({ useBusiness: () => ({ business: { vatEnabled: false } }) }));
vi.mock("@/lib/demo-api", () => ({ DEMO_MODE: false }));
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));
// Stand-ins for the pickers: one adds a product line, one types a new customer name.
vi.mock("@/components/invoices/InvoiceItemsEditor", () => ({
  default: ({ onAdd }: { onAdd: (p: unknown) => void }) => (
    <button type="button" onClick={() => onAdd({ id: "p-1", name: "كيك", sellingPrice: 10 })}>أضف كيك</button>
  ),
}));
vi.mock("@/components/invoices/InvoiceCustomerField", () => ({
  default: ({ query, onQueryChange }: { query: string; onQueryChange: (v: string) => void }) => (
    <input aria-label="الزبون" value={query} onChange={(e) => onQueryChange(e.target.value)} />
  ),
}));

import { apiGet, apiPost, ApiError } from "@/lib/api";
import NewInvoicePage from "@/app/(app)/invoices/new/page";

describe("فاتورة جديدة: إعادة المحاولة", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockResolvedValue([]);
    vi.mocked(apiPost).mockReset();
  });

  it("لا ينشئ الزبون الجديد مرتين إذا فشل حفظ الفاتورة ثم أعاد المستخدم المحاولة", async () => {
    vi.mocked(apiPost).mockImplementation(async (path: string) => {
      if (path === "/customers") return { id: "c-new", name: "أبو فهد" };
      throw new ApiError("تعذر إنشاء الفاتورة", 500);
    });
    render(<NewInvoicePage />);
    fireEvent.click(screen.getByText("أضف كيك"));
    fireEvent.change(screen.getByLabelText("الزبون"), { target: { value: "أبو فهد" } });

    fireEvent.click(screen.getByText("حفظ الفاتورة"));
    await screen.findByText("تعذر إنشاء الفاتورة");
    fireEvent.click(screen.getByText("حفظ الفاتورة"));
    await waitFor(() => expect(vi.mocked(apiPost).mock.calls.filter(([p]) => p === "/invoices")).toHaveLength(2));

    expect(vi.mocked(apiPost).mock.calls.filter(([p]) => p === "/customers")).toHaveLength(1);
    const invoiceBodies = vi.mocked(apiPost).mock.calls.filter(([p]) => p === "/invoices").map(([, body]) => body as { customerId?: string });
    expect(invoiceBodies.map((b) => b.customerId)).toEqual(["c-new", "c-new"]);
  });
});
