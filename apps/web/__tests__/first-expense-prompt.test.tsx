import React, { StrictMode } from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FirstExpensePrompt from "@/components/FirstExpensePrompt";
import { track } from "@/lib/analytics";
import { apiPost, ApiError } from "@/lib/api";
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiPost: vi.fn(), ApiError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
const open = () => fireEvent.click(screen.getByRole("button", { name: "سجّل أول مصروف" }));
const save = () => fireEvent.submit(screen.getByRole("button", { name: "حفظ" }).closest("form")!);
describe("first expense after setup", () => {
  beforeEach(() => vi.resetAllMocks());
  it("measures one impression in Strict Mode and one click despite reopening", () => {
    render(<StrictMode><FirstExpensePrompt onContinue={vi.fn()} /></StrictMode>);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("first_expense_prompt_viewed");
    open(); expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" })); open();
    expect(vi.mocked(track).mock.calls.filter(([event]) => event === "first_expense_prompt_clicked")).toHaveLength(1);
  });
  it("allows skipping without creating an expense", () => {
    const next = vi.fn(); render(<FirstExpensePrompt onContinue={next} />);
    fireEvent.click(screen.getByRole("button", { name: "لاحقًا، انتقل للرئيسية" }));
    expect(next).toHaveBeenCalledOnce(); expect(apiPost).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("first_expense_prompt_skipped");
    expect(track).not.toHaveBeenCalledWith("first_expense_completed");
  });
  it("counts completion only after a successful save, including retry after failure", async () => {
    const next = vi.fn(); render(<FirstExpensePrompt onContinue={next} />); open(); save();
    expect(apiPost).not.toHaveBeenCalled(); expect(track).not.toHaveBeenCalledWith("first_expense_completed");
    fireEvent.change(screen.getByLabelText("المبلغ"), { target: { value: "25" } });
    vi.mocked(apiPost).mockRejectedValueOnce(new ApiError("تعذر الحفظ", 500)); save();
    await screen.findByText("تعذر الحفظ"); expect(next).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalledWith("first_expense_completed");
    vi.mocked(apiPost).mockResolvedValueOnce({ id: "test-only" }); save();
    await waitFor(() => expect(next).toHaveBeenCalledOnce());
    expect(track).toHaveBeenCalledWith("expense_added", expect.anything());
    expect(track).toHaveBeenCalledWith("first_expense_completed");
  });
});
