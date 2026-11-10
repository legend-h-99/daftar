import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddExpenseSheet from "@/components/expenses/AddExpenseSheet";
import { apiPost, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiPost: vi.fn(), ApiError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
function setup() {
  const saved = vi.fn(), closed = vi.fn();
  render(<AddExpenseSheet onSaved={saved} onClose={closed} />);
  const amount = screen.getByLabelText("المبلغ");
  const submit = () => fireEvent.submit(screen.getByRole("button", { name: "حفظ" }).closest("form")!);
  return { amount, submit, saved, closed };
}
describe("expense save diagnostics", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["", "0", "-1"])("rejects invalid amount %s without claiming an HTTP failure", amount => {
    const form = setup(); fireEvent.change(form.amount, { target: { value: amount } }); form.submit();
    expect(apiPost).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("workflow_failed", { workflow: "expense", stage: "validation", reason: "invalid_amount" });
    expect(screen.getByText("أدخل مبلغًا أكبر من صفر")).toBeInTheDocument();
    expect(form.saved).not.toHaveBeenCalled();
  });
  it("distinguishes a missing date from an API rejection", () => {
    const form = setup(); fireEvent.change(form.amount, { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("التاريخ"), { target: { value: "" } }); form.submit();
    expect(apiPost).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("workflow_failed", { workflow: "expense", stage: "validation", reason: "missing_date" });
  });
  it("saves a valid expense and completes the workflow", async () => {
    vi.mocked(apiPost).mockResolvedValue({}); const form = setup();
    fireEvent.change(form.amount, { target: { value: "25.50" } }); form.submit();
    await waitFor(() => expect(form.saved).toHaveBeenCalledOnce());
    expect(apiPost).toHaveBeenCalledWith("/expenses", expect.objectContaining({ amount: 25.5, category: "INGREDIENTS" }));
    expect(track).toHaveBeenCalledWith("expense_added", { category: "INGREDIENTS" });
    expect(form.closed).toHaveBeenCalledOnce();
  });
  it.each([[new ApiError("Rejected", 400), "api", 400], [new Error("Offline"), "network", 0]])("keeps request failures distinct: %s", async (error, stage, status) => {
    vi.mocked(apiPost).mockRejectedValue(error); const form = setup();
    fireEvent.change(form.amount, { target: { value: "25" } }); form.submit();
    await waitFor(() => expect(track).toHaveBeenCalledWith("workflow_failed", { workflow: "expense", stage, status }));
    expect(form.saved).not.toHaveBeenCalled(); expect(form.closed).not.toHaveBeenCalled();
  });
});
