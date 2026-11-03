import React from "react";
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProductForm from "@/components/ProductForm";
import { apiGet, apiPatch } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn(),
  ApiError: class extends Error {},
}));

describe("product margin controls", () => {
  it("uses the current linked material price in both preview and saved recipe", async () => {
    vi.mocked(apiGet).mockResolvedValueOnce([{ id: "m-current", name: "مادة", unit: "PIECE", unitPrice: 3 }]);
    render(<ProductForm product={{ id: "p-current", name: "منتج", profitMargin: 0, recipeItems: [{ materialId: "m-current", name: "مادة", unit: "PIECE", unitPrice: 1, quantityUsed: 2, type: "RAW" }] } as never} />);
    await waitFor(() => expect(screen.getAllByText(/6\.00/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith("/products/p-current", expect.objectContaining({ recipeItems: expect.arrayContaining([expect.objectContaining({ unitPrice: 3, quantityUsed: 2 })]) })));
  });
  it("keeps the slider and numeric field consistent at the upper boundary", async () => {
    render(<ProductForm />);
    expect(screen.getByRole("note")).toHaveTextContent("تُحسب تكلفة المنتج صفراً");
    const slider = screen.getByRole("slider");
    const margin = screen.getByRole("spinbutton", { name: "نسبة الربح بالنسبة المئوية" });
    fireEvent.change(screen.getByLabelText(/تكاليف تشغيل إضافية/), { target: { value: "70" } });
    fireEvent.change(margin, { target: { value: "100" } });
    await waitFor(() => expect(screen.getByText(/1,400\.00/)).toBeInTheDocument());
    expect(margin).toHaveValue(95);
    expect(slider).toHaveValue("95");
    fireEvent.change(slider, { target: { value: "30" } });
    expect(margin).toHaveValue(30);
    expect(screen.getByText(/100\.00/)).toBeInTheDocument();
  });

  it("preserves fractional margins and clamps negative values in both controls", async () => {
    render(<ProductForm />);
    const slider = screen.getByRole("slider");
    const margin = screen.getByRole("spinbutton", { name: "نسبة الربح بالنسبة المئوية" });
    fireEvent.change(margin, { target: { value: "30.5" } });
    expect(margin).toHaveValue(30.5);
    expect(slider).toHaveValue("30.5");
    fireEvent.change(margin, { target: { value: "-1" } });
    expect(margin).toHaveValue(0);
    expect(slider).toHaveValue("0");
    await waitFor(() => expect(screen.getByRole("button", { name: "حفظ" })).toBeEnabled());
  });

  it("opens an existing product for editing even if it arrives without recipe items", () => {
    const product = { id: "p-1", name: "كيك", profitMargin: 25, rawCost: 0, packagingCost: 0, totalCost: 0, sellingPrice: 0 } as never;
    render(<ProductForm product={product} />);
    expect(screen.getByDisplayValue("كيك")).toBeInTheDocument();
  });
});
