import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Static mocks ─────────────────────────────────────────────────────────────

const mockPush    = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

const mockSetToken = vi.fn();

vi.mock("@/lib/auth", () => ({
  setToken: (t: string) => mockSetToken(t),
  getToken: vi.fn(),
  clearToken: vi.fn(),
}));

// DEMO_MODE=false في بيئة الاختبار (NEXT_PUBLIC_DEMO_MODE غير مضبوطة)
vi.mock("@/lib/demo-api", () => ({
  DEMO_MODE: false,
  DEMO_TOKEN: "demo-token-daftar",
  demoApiFetch: vi.fn(),
}));

vi.mock("@/components/GoogleSignInButton", () => ({
  default: () => <div data-testid="google-btn" />,
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import LoginPage from "@/app/login/page";
import { apiPost } from "@/lib/api";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة تسجيل الدخول (Login)", () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockSetToken.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── العرض ────────────────────────────────────────────────────────────────

  describe("العرض الأولي", () => {
    it("يعرض شعار دفتر وحقل الجوال وزر الإرسال", () => {
      render(<LoginPage />);
      expect(screen.getByText("دفتر")).toBeInTheDocument();
      expect(screen.getByLabelText("رقم الجوال")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      ).toBeInTheDocument();
    });

    it("يعرض زر الدخول التجريبي", () => {
      render(<LoginPage />);
      expect(
        screen.getByRole("button", { name: "دخول تجريبي" }),
      ).toBeInTheDocument();
    });

    it("يعرض زر Google", () => {
      render(<LoginPage />);
      expect(screen.getByTestId("google-btn")).toBeInTheDocument();
    });

    it("يعرض فاصل 'أو' بين Google والجوال", () => {
      render(<LoginPage />);
      // المحتوى الأول هو الفاصل بين Google والنموذج
      const separators = screen.getAllByText("أو");
      expect(separators.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── حقل الجوال ───────────────────────────────────────────────────────────

  describe("حقل رقم الجوال", () => {
    it("يقبل الأرقام فقط ويحذف الأحرف", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      const input = screen.getByLabelText("رقم الجوال");
      await user.type(input, "05abc12345");
      expect(input).toHaveValue("0512345");
    });

    it("يحدّ الإدخال بـ 10 أرقام", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      const input = screen.getByLabelText("رقم الجوال");
      await user.type(input, "05123456789999");
      expect((input as HTMLInputElement).value.length).toBe(10);
    });

    it("يحتفظ بالرقم المكتوب بشكل صحيح", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      const input = screen.getByLabelText("رقم الجوال");
      await user.type(input, "0512345678");
      expect(input).toHaveValue("0512345678");
    });
  });

  // ── التحقق من الصحة ──────────────────────────────────────────────────────

  describe("التحقق من صحة النموذج", () => {
    it("يُظهر خطأ عند الإرسال بحقل فارغ", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      expect(
        screen.getByText(/رقم الجوال غير صحيح/),
      ).toBeInTheDocument();
    });

    it("يُظهر خطأ إذا لم يبدأ الرقم بـ 05", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0612345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      expect(screen.getByText(/رقم الجوال غير صحيح/)).toBeInTheDocument();
    });

    it("يُظهر خطأ إذا كان الرقم أقل من 10 أرقام", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "05123");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      expect(screen.getByText(/رقم الجوال غير صحيح/)).toBeInTheDocument();
    });

    it("لا يرسل الطلب إذا كان الرقم غير صحيح", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0612345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
    });
  });

  // ── تدفق OTP ─────────────────────────────────────────────────────────────

  describe("إرسال رمز التحقق", () => {
    it("يستدعي API بالرقم الصحيح", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({ sent: true });
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0512345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() =>
        expect(vi.mocked(apiPost)).toHaveBeenCalledWith(
          "/auth/otp/request",
          { phone: "0512345678" },
        ),
      );
    });

    it("يحفظ بيانات OTP في sessionStorage وينتقل إلى /otp", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockResolvedValue({ sent: true, devCode: "1234" });
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0512345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/otp"));
      const stored = JSON.parse(
        sessionStorage.getItem("daftar_otp_flow") ?? "{}",
      );
      expect(stored.phone).toBe("0512345678");
      expect(stored.devCode).toBe("1234");
    });

    it("يعرض خطأ ApiError كما هو", async () => {
      const { ApiError } = await import("@/lib/api");
      const user = userEvent.setup();
      vi.mocked(apiPost).mockRejectedValue(
        new ApiError("هذا الرقم محظور", 403),
      );
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0512345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() =>
        expect(screen.getByText("هذا الرقم محظور")).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة خطأ افتراضية عند خطأ الشبكة", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockRejectedValue(new Error("network error"));
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0512345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() =>
        expect(
          screen.getByText("تعذر إرسال رمز التحقق، حاول مرة أخرى"),
        ).toBeInTheDocument(),
      );
    });

    it("يعطّل الزر أثناء الإرسال ويُظهر 'جاري الإرسال...'", async () => {
      const user = userEvent.setup();
      vi.mocked(apiPost).mockReturnValue(new Promise(() => {})); // لا يُحل أبداً
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0512345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "جاري الإرسال..." }),
        ).toBeDisabled(),
      );
    });

    it("يختفي الخطأ السابق عند إرسال ناجح جديد", async () => {
      const user = userEvent.setup();
      // أول محاولة تفشل
      vi.mocked(apiPost).mockRejectedValueOnce(new Error("fail"));
      render(<LoginPage />);
      await user.type(screen.getByLabelText("رقم الجوال"), "0512345678");
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() =>
        expect(
          screen.getByText("تعذر إرسال رمز التحقق، حاول مرة أخرى"),
        ).toBeInTheDocument(),
      );
      // المحاولة الثانية تنجح
      vi.mocked(apiPost).mockResolvedValueOnce({ sent: true });
      await user.click(
        screen.getByRole("button", { name: "إرسال رمز التحقق" }),
      );
      await waitFor(() =>
        expect(
          screen.queryByText("تعذر إرسال رمز التحقق، حاول مرة أخرى"),
        ).not.toBeInTheDocument(),
      );
    });
  });

  // ── الدخول التجريبي (DEMO_MODE=false) ────────────────────────────────────

  describe("الدخول التجريبي – الوضع العادي", () => {
    it("يملأ حقل الجوال برقم أحد المحلات التجريبية", async () => {
      const user = userEvent.setup();
      const DEMO_PHONES = [
        "0500000001","0500000002","0500000003","0500000004",
        "0500000005","0500000006","0500000007","0500000008",
      ];
      render(<LoginPage />);
      await user.click(
        screen.getByRole("button", { name: "دخول تجريبي" }),
      );
      const input = screen.getByLabelText("رقم الجوال") as HTMLInputElement;
      expect(DEMO_PHONES).toContain(input.value);
    });

    it("لا يستدعي API عند الضغط على الدخول التجريبي في الوضع العادي", async () => {
      const user = userEvent.setup();
      render(<LoginPage />);
      await user.click(
        screen.getByRole("button", { name: "دخول تجريبي" }),
      );
      expect(vi.mocked(apiPost)).not.toHaveBeenCalled();
    });
  });
});
