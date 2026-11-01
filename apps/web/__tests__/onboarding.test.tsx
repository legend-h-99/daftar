import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Static mocks ─────────────────────────────────────────────────────────────

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api", () => ({
  apiPost: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

const mockGetToken = vi.fn();
const mockSetToken = vi.fn();

vi.mock("@/lib/auth", () => ({
  usesSessionProxy: () => false,
  getToken: () => mockGetToken(),
  isAuthenticated: () => !!mockGetToken(),
  setToken: (t: string) => mockSetToken(t),
  clearToken: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import OnboardingPage from "@/app/onboarding/page";
import { apiPost } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderWithToken() {
  mockGetToken.mockReturnValue("test-token");
  render(<OnboardingPage />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة الإعداد الأولي (Onboarding)", () => {
  beforeEach(() => {
    mockGetToken.mockReturnValue("test-token");
    vi.mocked(apiPost).mockReset();
    mockReplace.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── التوجيه ──────────────────────────────────────────────────────────────

  describe("التوجيه", () => {
    it("يعيد التوجيه إلى تسجيل الدخول إن لم يوجد توكن", () => {
      mockGetToken.mockReturnValue(null);
      render(<OnboardingPage />);
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });

    it("لا يعيد التوجيه إذا كان التوكن موجوداً", () => {
      renderWithToken();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  // ── النموذج ──────────────────────────────────────────────────────────────

  describe("نموذج المحل", () => {
    it("يعرض العنوان وحقلَي الاسم والمدينة في شاشة واحدة", () => {
      renderWithToken();
      expect(screen.getByText("بيانات المحل")).toBeInTheDocument();
      expect(screen.getByLabelText(/اسم المحل/)).toBeInTheDocument();
      expect(screen.getByLabelText(/المدينة/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "حفظ والمتابعة" })).toBeInTheDocument();
      expect(screen.queryByText(/الخطوة/)).not.toBeInTheDocument();
    });

    it("يعرض خطأ ولا يرسل الطلب إذا كان الاسم فارغاً", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      expect(screen.getByText("اكتب اسم المحل أولاً")).toBeInTheDocument();
      expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
    });
  });

  // ── الرقم الضريبي ────────────────────────────────────────────────────────

  describe("الرقم الضريبي الاختياري", () => {
    it("لا يسأل عن الضريبة افتراضياً", () => {
      renderWithToken();
      const option = screen.getByRole("button", { name: "عندي رقم ضريبي" });
      expect(option).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByLabelText(/الرقم الضريبي/)).not.toBeInTheDocument();
      expect(screen.queryByText(/ضريبة القيمة المضافة/)).not.toBeInTheDocument();
    });

    it("يظهر الحقل عند اختيار 'عندي رقم ضريبي' ويختفي عند التراجع", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.click(screen.getByRole("button", { name: "عندي رقم ضريبي" }));
      expect(screen.getByLabelText(/الرقم الضريبي/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "ما عندي رقم ضريبي" }));
      expect(screen.queryByLabelText(/الرقم الضريبي/)).not.toBeInTheDocument();
    });

    it("يُظهر خطأ إذا فُتح الحقل وبقي فارغاً", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "بيت الحلا");
      await user.click(screen.getByRole("button", { name: "عندي رقم ضريبي" }));
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      expect(screen.getByText("أدخل الرقم الضريبي أو اختر «ما عندي رقم ضريبي»")).toBeInTheDocument();
      expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
    });

    it("يرفض رقماً ضريبياً لا يطابق الصيغة ولا يرسل الطلب", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "بيت الحلا");
      await user.click(screen.getByRole("button", { name: "عندي رقم ضريبي" }));
      await user.type(screen.getByLabelText(/الرقم الضريبي/), "ABC123");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      expect(
        screen.getByText("الرقم الضريبي يجب أن يكون 15 رقماً يبدأ بـ 3 وينتهي بـ 3"),
      ).toBeInTheDocument();
      expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
    });

    it("يقبل الرقم الضريبي بالأرقام العربية ويرسله بالأرقام اللاتينية", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({ accessToken: "tok", business: { id: "b1", name: "المحل", vatEnabled: true } });
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "بيت الحلا");
      await user.click(screen.getByRole("button", { name: "عندي رقم ضريبي" }));
      await user.type(screen.getByLabelText(/الرقم الضريبي/), "٣٠٠٠٠٠٠٠٠٠٠٠٠٠٣");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/onboarding", expect.objectContaining({ vatNumber: "300000000000003" })),
      );
    });
  });

  // ── الإرسال ──────────────────────────────────────────────────────────────

  describe("إرسال النموذج", () => {
    it("يرسل الاسم والضريبة معطّلة عند عدم التفعيل", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({
        accessToken: "new-token",
        business: { id: "b1", name: "المحل", vatEnabled: false },
      });
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "المحل");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/onboarding", {
          name: "المحل",
          vatEnabled: false,
          vatNumber: undefined,
          city: undefined,
        }),
      );
    });

    it("يرسل الاسم والمدينة والرقم الضريبي عند التفعيل", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({
        accessToken: "tok",
        business: { id: "b1", name: "المحل", vatEnabled: true },
      });
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "مطعم السلام");
      await user.type(screen.getByLabelText(/المدينة/), "الرياض");
      await user.click(screen.getByRole("button", { name: "عندي رقم ضريبي" }));
      await user.type(screen.getByLabelText(/الرقم الضريبي/), "300000000000003");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/onboarding", {
          name: "مطعم السلام",
          vatEnabled: true,
          vatNumber: "300000000000003",
          city: "الرياض",
        }),
      );
    });

    it("يحفظ التوكن ويعرض أول مصروف قبل الانتقال للرئيسية", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({
        accessToken: "fresh-token",
        business: { id: "b1", name: "المحل", vatEnabled: false },
      });
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "محل");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() => {
        expect(mockSetToken).toHaveBeenCalledWith("fresh-token");
        expect(screen.getByRole("button", { name: "سجّل أول مصروف" })).toBeInTheDocument();
        expect(mockReplace).not.toHaveBeenCalled();
      });
    });

    it("يعرض رسالة الخطأ عند فشل الحفظ", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockRejectedValue(new Error("network error"));
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "محل");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(screen.getByText("تعذر حفظ بيانات المحل")).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError كما هي", async () => {
      const { ApiError } = await import("@/lib/api");
      const user = userEvent.setup();
      vi.mocked(apiPost).mockRejectedValue(new ApiError("اسم المحل مكرر", 409));
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "محل");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(screen.getByText("اسم المحل مكرر")).toBeInTheDocument(),
      );
    });

    it("يُعطّل زر الحفظ أثناء الإرسال", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockReturnValue(new Promise(() => {})); // never resolves
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "محل");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "جاري الحفظ..." }),
        ).toBeDisabled(),
      );
    });
  });
});
