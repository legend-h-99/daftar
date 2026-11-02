import { fireEvent, render, waitFor } from "@/test/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import PurchaseForm from "@/components/PurchaseForm";
import { apiPost, ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn().mockResolvedValue([]), apiPost: vi.fn(),
  ApiError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
vi.mock("@/components/purchases/PurchaseRow", () => ({
  default: () => null, NEW_MATERIAL: "new", purchaseInputClass: "",
  emptyRow: () => ({ name: "مادة", unit: "PIECE", quantity: "1", unitPrice: "5" }),
}));
beforeEach(() => { sessionStorage.clear(); vi.mocked(apiPost).mockReset(); });

it("retains the purchase key across an ambiguous network failure and page remount", async () => {
  vi.mocked(apiPost).mockRejectedValueOnce(new ApiError("Network", 0)).mockResolvedValueOnce({ id: "saved" });
  const first = render(<PurchaseForm source="MANUAL" />);
  fireEvent.submit(first.container.querySelector("form")!);
  await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
  const key = sessionStorage.getItem("daftar_pending_purchase"); expect(key).toBeTruthy();
  first.unmount();
  const second = render(<PurchaseForm source="MANUAL" />);
  fireEvent.submit(second.container.querySelector("form")!);
  await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
  expect(vi.mocked(apiPost).mock.calls[0][2]?.headers).toEqual({ "Idempotency-Key": key });
  expect(vi.mocked(apiPost).mock.calls[1][2]?.headers).toEqual({ "Idempotency-Key": key });
  await waitFor(() => expect(sessionStorage.getItem("daftar_pending_purchase")).toBeNull());
});
