import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, it, expect } from "vitest";
vi.mock("next/link", () => ({
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  ApiError: class extends Error {},
}));
vi.mock("@/lib/use-month-resource", () => ({
  useMonthResource: () => ({
    month: "2026-11",
    data: { entries: [], count: 0, cashIn: 0, cashOut: 0 },
    reload: vi.fn(),
  }),
}));
import { apiPost, ApiError } from "@/lib/api";
import FundingPage from "@/app/(app)/funding/page";
import BottomSheet from "@/components/BottomSheet";
it("reuses the same request ID on a failed financing submission", async () => {
  vi.mocked(apiPost)
    .mockRejectedValueOnce(new ApiError("تعذر الحفظ", 503))
    .mockResolvedValueOnce({ id: "one" });
  render(<FundingPage />);
  fireEvent.change(screen.getByLabelText("المبلغ (ر.س)"), {
    target: { value: "100" },
  });
  fireEvent.click(screen.getByRole("button", { name: "حفظ الحركة" }));
  await screen.findByText("تعذر الحفظ");
  fireEvent.click(screen.getByRole("button", { name: "حفظ الحركة" }));
  await screen.findByText("تم حفظ الحركة. التمويل لا يغيّر الربح.");
  expect(vi.mocked(apiPost).mock.calls[0][1]).toEqual(
    vi.mocked(apiPost).mock.calls[1][1],
  );
  expect(vi.mocked(apiPost).mock.calls[0][0]).toBe("/funding");
});
it("renders sheets outside transformed content and closes without submitting the child form", async () => {
  const close = vi.fn(),
    submit = vi.fn();
  render(
    <div style={{ transform: "translateY(0)" }}>
      <BottomSheet title="صنف جديد" onClose={close}>
        <form onSubmit={submit}>
          <input required />
          <button>حفظ</button>
        </form>
      </BottomSheet>
    </div>,
  );
  expect(screen.getByRole("dialog").parentElement?.parentElement).toBe(
    document.body,
  );
  fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(submit).not.toHaveBeenCalled();
});
