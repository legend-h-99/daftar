import React from "react";
import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProductForm from "@/components/ProductForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn(),
  ApiError: class extends Error {},
}));

describe("product margin controls", () => {
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
});
