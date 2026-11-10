import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Uses the real items editor: a new user with no products must be able to
// write an invoice by typing the item name and price.
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
vi.mock("@/components/invoices/InvoiceCustomerField", () => ({
  default: () => null,
}));

import { apiGet, apiPost } from "@/lib/api";
import NewInvoicePage from "@/app/(app)/invoices/new/page";

describe("فاتورة جديدة بصنف مكتوب يدوياً", () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockResolvedValue([]); // no products, no customers
    vi.mocked(apiPost).mockReset();
  });

  it("تفتح الصفحة بسطر جاهز للكتابة", () => {
    render(<NewInvoicePage />);
    expect(screen.getAllByLabelText("اسم الصنف")).toHaveLength(1);
    expect(screen.getByLabelText("سعر الوحدة")).toBeTruthy();
  });

  it("يحفظ فاتورة بصنف مكتوب يدوياً بدون منتج", async () => {
    vi.mocked(apiPost).mockResolvedValue({ id: "inv-1" });
    render(<NewInvoicePage />);
    fireEvent.change(screen.getByLabelText("اسم الصنف"), { target: { value: "  كيكة شوكولاتة " } });
    fireEvent.change(screen.getByLabelText("سعر الوحدة"), { target: { value: "45" } });
    fireEvent.click(screen.getByLabelText("زيادة الكمية"));
    fireEvent.click(screen.getByText("حفظ الفاتورة"));

    await waitFor(() => expect(vi.mocked(apiPost)).toHaveBeenCalledTimes(1));
    const [path, body] = vi.mocked(apiPost).mock.calls[0];
    expect(path).toBe("/invoices");
    expect((body as { items: unknown[] }).items).toEqual([
      { productId: undefined, name: "كيكة شوكولاتة", unitPrice: 45, quantity: 2 },
    ]);
  });

  it("يرفض سطراً له سعر بدون اسم", async () => {
    render(<NewInvoicePage />);
    fireEvent.change(screen.getByLabelText("سعر الوحدة"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("حفظ الفاتورة"));
    await screen.findByText("اكتب اسم كل صنف");
    expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
  });

  it("زر «إضافة صنف» يضيف سطراً جديداً، والأسطر الفارغة لا تُرسل", async () => {
    vi.mocked(apiPost).mockResolvedValue({ id: "inv-1" });
    render(<NewInvoicePage />);
    fireEvent.click(screen.getByText("إضافة صنف"));
    expect(screen.getAllByLabelText("اسم الصنف")).toHaveLength(2);

    fireEvent.change(screen.getAllByLabelText("اسم الصنف")[0], { target: { value: "توزيعات" } });
    fireEvent.change(screen.getAllByLabelText("سعر الوحدة")[0], { target: { value: "12.5" } });
    fireEvent.click(screen.getByText("حفظ الفاتورة"));

    await waitFor(() => expect(vi.mocked(apiPost)).toHaveBeenCalledTimes(1));
    expect((vi.mocked(apiPost).mock.calls[0][1] as { items: unknown[] }).items).toEqual([
      { productId: undefined, name: "توزيعات", unitPrice: 12.5, quantity: 1 },
    ]);
  });
});
