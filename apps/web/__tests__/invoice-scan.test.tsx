import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { scaledSize } from "@/lib/scan-image";

const features = vi.hoisted(() => ({ SCAN_ENABLED: true }));
const api = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.name = "ApiError";
    }
  }
  return { apiPost: vi.fn(), ApiError };
});

vi.mock("@/lib/features", () => features);
vi.mock("@/lib/api", () => api);
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/scan-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scan-image")>()),
  prepareInvoiceImage: vi.fn(async () => "data:image/jpeg;base64,AAAA"),
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
vi.mock("@/components/PurchaseForm", () => ({
  default: ({ draft, source }: { draft: { items: { name: string }[] }; source: string }) => (
    <div data-testid="purchase-form" data-source={source}>{draft.items.map((i) => i.name).join(",")}</div>
  ),
}));

import ScanPurchasePage from "@/app/(app)/purchases/scan/page";

function choosePhoto() {
  const input = screen.getByLabelText("صورة الفاتورة");
  fireEvent.change(input, { target: { files: [new File(["x"], "invoice.jpg", { type: "image/jpeg" })] } });
}

describe("invoice scan page", () => {
  beforeEach(() => {
    features.SCAN_ENABLED = true;
    api.apiPost.mockReset();
  });

  it("turns a photo into a draft that the owner reviews before saving", async () => {
    api.apiPost.mockResolvedValue({
      provider: "anthropic", confidence: 0.9, remaining: 2,
      items: [{ name: "طحين", unit: "KG", quantity: 10, unitPrice: 3, confidence: 0.9 }],
    });
    render(<ScanPurchasePage />);
    choosePhoto();
    const form = await screen.findByTestId("purchase-form");
    expect(form).toHaveTextContent("طحين");
    expect(form).toHaveAttribute("data-source", "OCR");
    expect(api.apiPost).toHaveBeenCalledWith("/purchases/scan", { imageBase64: "data:image/jpeg;base64,AAAA" });
    expect(screen.getByText("المتبقي من المسح هذا الشهر: 2")).toBeInTheDocument();
  });

  it("offers manual entry when the month's scans are used up", async () => {
    api.apiPost.mockRejectedValue(new api.ApiError("quota", 429, "SCAN_QUOTA_EXCEEDED"));
    render(<ScanPurchasePage />);
    choosePhoto();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("استخدمت كل صفحات المسح"));
    expect(screen.getByRole("link", { name: "إدخال الشراء يدويًا" })).toHaveAttribute("href", "/purchases/new");
    expect(screen.queryByTestId("purchase-form")).not.toBeInTheDocument();
  });

  it("asks for a clearer photo when nothing could be read", async () => {
    api.apiPost.mockRejectedValue(new api.ApiError("unreadable", 422, "SCAN_UNREADABLE"));
    render(<ScanPurchasePage />);
    choosePhoto();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("صوّر الفاتورة كاملة"));
  });

  it("keeps the manual guide and uploads nothing while scanning is off", () => {
    features.SCAN_ENABLED = false;
    render(<ScanPurchasePage />);
    expect(screen.getByText("قراءة الفاتورة آليًا غير مفعّلة حاليًا")).toBeInTheDocument();
    expect(screen.queryByLabelText("صورة الفاتورة")).not.toBeInTheDocument();
  });
});

describe("scaledSize", () => {
  it("shrinks the longest side to the limit and keeps the aspect ratio", () => {
    expect(scaledSize(4032, 3024)).toEqual({ width: 2000, height: 1500 });
    expect(scaledSize(1000, 3000)).toEqual({ width: 667, height: 2000 });
    expect(scaledSize(1200, 900)).toEqual({ width: 1200, height: 900 });
  });
});
