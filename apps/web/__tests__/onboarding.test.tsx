import { render, screen, waitFor } from "@testing-library/react";
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
  getToken: () => mockGetToken(),
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

async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText(/اسم المحل/);
  await user.type(input, "بيت الحلا");
  await user.click(screen.getByRole("button", { name: "التالي" }));
  await waitFor(() =>
    expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
  );
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

  // ── الخطوة الأولى ────────────────────────────────────────────────────────

  describe("الخطوة الأولى – معلومات المحل", () => {
    it("يعرض العنوان وحقلَي الاسم والمدينة", () => {
      renderWithToken();
      expect(screen.getByText("بيانات المحل")).toBeInTheDocument();
      expect(screen.getByLabelText(/اسم المحل/)).toBeInTheDocument();
      expect(screen.getByLabelText(/المدينة/)).toBeInTheDocument();
    });

    it("يعرض 'الخطوة 1 من 2' في شريط التقدم", () => {
      renderWithToken();
      expect(screen.getByText("الخطوة 1 من 2")).toBeInTheDocument();
    });

    it("يعرض خطأ إذا ضغط التالي بدون اسم", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.click(screen.getByRole("button", { name: "التالي" }));
      expect(screen.getByText("اكتب اسم المحل أولاً")).toBeInTheDocument();
    });

    it("لا يتقدم للخطوة الثانية إذا كان الاسم فارغاً", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.click(screen.getByRole("button", { name: "التالي" }));
      expect(screen.queryByText("إعدادات الضريبة")).not.toBeInTheDocument();
    });

    it("يتقدم للخطوة الثانية عند إدخال اسم صحيح", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "بيت الحلا");
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
    });

    it("يقبل المدينة كحقل اختياري دون خطأ", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "المطعم");
      await user.type(screen.getByLabelText(/المدينة/), "جدة");
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
    });
  });

  // ── الخطوة الثانية ───────────────────────────────────────────────────────

  describe("الخطوة الثانية – إعدادات الضريبة", () => {
    it("يعرض 'الخطوة 2 من 2' في شريط التقدم", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await advanceToStep2(user);
      expect(screen.getByText("الخطوة 2 من 2")).toBeInTheDocument();
    });

    it("المفتاح مغلق افتراضياً ولا يظهر حقل الرقم الضريبي", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await advanceToStep2(user);
      const toggle = screen.getByRole("switch");
      expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(screen.queryByLabelText(/الرقم الضريبي/)).not.toBeInTheDocument();
    });

    it("يظهر حقل الرقم الضريبي بعد تفعيل المفتاح", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await advanceToStep2(user);
      await user.click(screen.getByRole("switch"));
      expect(screen.getByLabelText(/الرقم الضريبي/)).toBeInTheDocument();
    });

    it("يُظهر خطأ إذا كانت الضريبة مفعّلة والرقم فارغ", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await advanceToStep2(user);
      await user.click(screen.getByRole("switch"));
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      expect(
        screen.getByText("أدخل الرقم الضريبي أو أوقف تفعيل الضريبة"),
      ).toBeInTheDocument();
    });

    it("زر الرجوع يعيد للخطوة الأولى", async () => {
      const user = userEvent.setup();
      renderWithToken();
      await advanceToStep2(user);
      await user.click(screen.getByRole("button", { name: "رجوع" }));
      await waitFor(() =>
        expect(screen.getByText("معلومات المحل")).toBeInTheDocument(),
      );
    });

    it("يحفظ الاسم بعد الرجوع والتقدم مجدداً", async () => {
      const user = userEvent.setup();
      renderWithToken();
      const nameInput = screen.getByLabelText(/اسم المحل/);
      await user.type(nameInput, "كافيه الورد");
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "رجوع" }));
      await waitFor(() =>
        expect(screen.getByLabelText(/اسم المحل/)).toHaveValue("كافيه الورد"),
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
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
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
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("switch"));
      await user.type(screen.getByLabelText(/الرقم الضريبي/), "3000000000003");
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/onboarding", {
          name: "مطعم السلام",
          vatEnabled: true,
          vatNumber: "3000000000003",
          city: "الرياض",
        }),
      );
    });

    it("يحفظ التوكن ويوجّه للوحة التحكم بعد النجاح", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({
        accessToken: "fresh-token",
        business: { id: "b1", name: "المحل", vatEnabled: false },
      });
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "محل");
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() => {
        expect(mockSetToken).toHaveBeenCalledWith("fresh-token");
        expect(mockReplace).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("يعرض رسالة الخطأ عند فشل الحفظ", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockRejectedValue(new Error("network error"));
      renderWithToken();
      await user.type(screen.getByLabelText(/اسم المحل/), "محل");
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
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
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
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
      await user.click(screen.getByRole("button", { name: "التالي" }));
      await waitFor(() =>
        expect(screen.getByText("إعدادات الضريبة")).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: "حفظ والمتابعة" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "جاري الحفظ..." }),
        ).toBeDisabled(),
      );
    });
  });
});
