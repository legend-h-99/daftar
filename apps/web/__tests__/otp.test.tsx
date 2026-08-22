import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Static mocks ─────────────────────────────────────────────────────────────

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
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

// ── Imports (after mocks) ────────────────────────────────────────────────────

import OtpPage from "@/app/otp/page";
import { apiPost } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSession(phone = "0512345678", devCode = "") {
  sessionStorage.setItem(
    "daftar_otp_flow",
    JSON.stringify({ phone, devCode }),
  );
}

/** يملأ مربعات OTP عبر fireEvent مباشرةً */
function fillOtp(code: string) {
  const inputs = screen.getAllByRole("textbox");
  code.split("").forEach((c, i) => {
    fireEvent.change(inputs[i], { target: { value: c } });
  });
}

function successPayload(hasBusiness = true) {
  return {
    accessToken: "tok-abc",
    user: { id: "u1" },
    hasBusiness,
    business: hasBusiness ? { id: "b1", name: "المحل", vatEnabled: false } : undefined,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة رمز التحقق (OTP)", () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset();
    mockReplace.mockReset();
    mockSetToken.mockReset();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── قراءة الجلسة ─────────────────────────────────────────────────────────

  describe("قراءة الجلسة", () => {
    it("يعيد التوجيه لتسجيل الدخول إذا لم توجد بيانات الجلسة", async () => {
      render(<OtpPage />);
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/login"),
      );
    });

    it("يعيد التوجيه إذا كانت بيانات الجلسة تالفة", async () => {
      sessionStorage.setItem("daftar_otp_flow", "not{{json");
      render(<OtpPage />);
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/login"),
      );
    });

    it("يعرض رقم الهاتف المُخزَّن في الجلسة", async () => {
      setupSession("0512345678");
      render(<OtpPage />);
      await waitFor(() =>
        expect(screen.getByText("0512345678")).toBeInTheDocument(),
      );
    });

    it("يُظهر بانر كود التطوير عند وجوده", async () => {
      setupSession("0512345678", "123456");
      render(<OtpPage />);
      await waitFor(() =>
        expect(screen.getByText("وضع تجريبي — اضغط للملء")).toBeInTheDocument(),
      );
      expect(screen.getByText("123456")).toBeInTheDocument();
    });

    it("لا يُظهر البانر إذا كان devCode فارغاً", async () => {
      setupSession("0512345678", "");
      render(<OtpPage />);
      await waitFor(() =>
        expect(screen.getByText("0512345678")).toBeInTheDocument(),
      );
      expect(
        screen.queryByText("وضع تجريبي — اضغط للملء"),
      ).not.toBeInTheDocument();
    });
  });

  // ── إدخال الأرقام ─────────────────────────────────────────────────────────

  describe("إدخال الأرقام", () => {
    it("يعرض 6 مربعات إدخال", async () => {
      setupSession();
      render(<OtpPage />);
      await waitFor(() =>
        expect(screen.getAllByRole("textbox")).toHaveLength(6),
      );
    });

    it("يملأ الخانة بالرقم المكتوب", async () => {
      setupSession();
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fireEvent.change(screen.getAllByRole("textbox")[0], {
        target: { value: "5" },
      });
      expect(screen.getAllByRole("textbox")[0]).toHaveValue("5");
    });

    it("يتجاهل الأحرف غير الرقمية", async () => {
      setupSession();
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fireEvent.change(screen.getAllByRole("textbox")[0], {
        target: { value: "x" },
      });
      expect(screen.getAllByRole("textbox")[0]).toHaveValue("");
    });

    it("يملأ خانات متعددة عند اللصق في خانة واحدة", async () => {
      setupSession();
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fireEvent.change(screen.getAllByRole("textbox")[0], {
        target: { value: "1234" },
      });
      const inputs = screen.getAllByRole("textbox");
      expect(inputs[0]).toHaveValue("1");
      expect(inputs[1]).toHaveValue("2");
      expect(inputs[2]).toHaveValue("3");
      expect(inputs[3]).toHaveValue("4");
    });

    it("يملأ جميع الخانات بضغطة زر كود التطوير", async () => {
      const user = userEvent.setup();
      setupSession("0512345678", "987654");
      render(<OtpPage />);
      await waitFor(() =>
        expect(screen.getByText("وضع تجريبي — اضغط للملء")).toBeInTheDocument(),
      );
      await user.click(screen.getByText("وضع تجريبي — اضغط للملء"));
      const joined = screen
        .getAllByRole("textbox")
        .map((el) => (el as HTMLInputElement).value)
        .join("");
      expect(joined).toBe("987654");
    });
  });

  // ── زر التأكيد ───────────────────────────────────────────────────────────

  describe("زر التأكيد", () => {
    it("معطّل عندما تكون الخانات غير مكتملة", async () => {
      setupSession();
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      expect(
        screen.getByRole("button", { name: "تأكيد الرمز" }),
      ).toBeDisabled();
    });

    it("مفعّل بعد ملء الخانات الستة", async () => {
      setupSession();
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("123456");
      expect(
        screen.getByRole("button", { name: "تأكيد الرمز" }),
      ).not.toBeDisabled();
    });
  });

  // ── التحقق من الرمز ──────────────────────────────────────────────────────

  describe("التحقق من الرمز", () => {
    it("يستدعي API بالهاتف والرمز الصحيحين", async () => {
      const user = userEvent.setup();
      setupSession("0512345678");
      vi.mocked(apiPost).mockResolvedValue(successPayload());
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("123456");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() =>
        expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/auth/otp/verify", {
          phone: "0512345678",
          code: "123456",
        }),
      );
    });

    it("يحفظ التوكن ويوجّه للوحة التحكم عند hasBusiness=true", async () => {
      const user = userEvent.setup();
      setupSession();
      vi.mocked(apiPost).mockResolvedValue(successPayload(true));
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("123456");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() => {
        expect(mockSetToken).toHaveBeenCalledWith("tok-abc");
        expect(mockReplace).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("يوجّه للإعداد الأولي عند hasBusiness=false", async () => {
      const user = userEvent.setup();
      setupSession();
      vi.mocked(apiPost).mockResolvedValue(successPayload(false));
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("123456");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/onboarding"),
      );
    });

    it("يحذف بيانات الجلسة بعد النجاح", async () => {
      const user = userEvent.setup();
      setupSession();
      vi.mocked(apiPost).mockResolvedValue(successPayload());
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("123456");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() =>
        expect(sessionStorage.getItem("daftar_otp_flow")).toBeNull(),
      );
    });

    it("يعرض رسالة الخطأ الافتراضية عند فشل الرمز", async () => {
      const user = userEvent.setup();
      setupSession();
      vi.mocked(apiPost).mockRejectedValue(new Error("wrong"));
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("000000");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() =>
        expect(
          screen.getByText("الرمز غير صحيح، حاول مرة أخرى"),
        ).toBeInTheDocument(),
      );
    });

    it("يعرض رسالة ApiError كما هي", async () => {
      const { ApiError } = await import("@/lib/api");
      const user = userEvent.setup();
      setupSession();
      vi.mocked(apiPost).mockRejectedValue(
        new ApiError("انتهت صلاحية الرمز", 401),
      );
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("000000");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() =>
        expect(screen.getByText("انتهت صلاحية الرمز")).toBeInTheDocument(),
      );
    });

    it("يعطّل الزر ويعرض 'جاري التأكيد...' أثناء الإرسال", async () => {
      const user = userEvent.setup();
      setupSession();
      vi.mocked(apiPost).mockReturnValue(new Promise(() => {}));
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("123456");
      await user.click(screen.getByRole("button", { name: "تأكيد الرمز" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "جاري التأكيد..." }),
        ).toBeDisabled(),
      );
    });
  });

  // ── الإرسال التلقائي ──────────────────────────────────────────────────────
  // تستخدم توقيتات حقيقية — الـ 280ms كافية في بيئة الاختبار

  describe("الإرسال التلقائي عند اكتمال الرمز", () => {
    it("يُرسل تلقائياً بعد 280ms من اكتمال 6 أرقام", async () => {
      setupSession("0512345678");
      vi.mocked(apiPost).mockResolvedValue(successPayload());
      render(<OtpPage />);
      await waitFor(() => screen.getAllByRole("textbox"));
      fillOtp("654321");
      await waitFor(
        () =>
          expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/auth/otp/verify", {
            phone: "0512345678",
            code: "654321",
          }),
        { timeout: 2000 },
      );
    });
  });

  // ── إعادة إرسال الرمز ────────────────────────────────────────────────────
  // تستخدم fake timers — محاطة بـ beforeEach/afterEach لضمان تنظيف آمن

  describe("إعادة إرسال الرمز", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    /** يُقدّم العدّ التنازلي ثانيةً بثانية — كل act يُفرغ تحديثات React */
    async function skipCountdown(seconds = 61) {
      for (let i = 0; i < seconds; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
    }

    it("يعرض العدّ التنازلي ابتداءً ولا يظهر زر الإعادة", async () => {
      setupSession();
      render(<OtpPage />);
      await act(async () => {});
      expect(screen.getByText(/أعد المحاولة بعد/)).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "أعد إرسال الرمز" }),
      ).not.toBeInTheDocument();
    });

    it("يظهر زر إعادة الإرسال بعد انتهاء العدّ التنازلي", async () => {
      setupSession();
      render(<OtpPage />);
      await skipCountdown();
      expect(
        screen.getByRole("button", { name: "أعد إرسال الرمز" }),
      ).toBeInTheDocument();
    });

    it("يستدعي API ويُعيد العدّ لـ 60 بعد الإعادة", async () => {
      setupSession("0512345678");
      vi.mocked(apiPost).mockResolvedValue({ sent: true });
      render(<OtpPage />);
      await skipCountdown();
      const resendBtn = screen.getByRole("button", { name: "أعد إرسال الرمز" });
      // استعادة الوقت الحقيقي قبل النقر لأن apiPost يستخدم Promises
      vi.useRealTimers();
      await act(async () => { resendBtn.click(); });
      expect(vi.mocked(apiPost)).toHaveBeenCalledWith("/auth/otp/request", {
        phone: "0512345678",
      });
      await waitFor(() =>
        expect(screen.getByText(/أعد المحاولة بعد/)).toBeInTheDocument(),
      );
    });

    it("يعرض خطأ عند فشل إعادة الإرسال", async () => {
      setupSession();
      vi.mocked(apiPost).mockRejectedValue(new Error("fail"));
      render(<OtpPage />);
      await skipCountdown();
      const resendBtn = screen.getByRole("button", { name: "أعد إرسال الرمز" });
      vi.useRealTimers();
      await act(async () => { resendBtn.click(); });
      await waitFor(() =>
        expect(
          screen.getByText("تعذر إعادة الإرسال، حاول مرة أخرى"),
        ).toBeInTheDocument(),
      );
    });
  });

  // ── التنقل ───────────────────────────────────────────────────────────────

  describe("التنقل", () => {
    it("زر 'تغيير الرقم' يعيد التوجيه لتسجيل الدخول", async () => {
      const user = userEvent.setup();
      setupSession();
      render(<OtpPage />);
      await waitFor(() =>
        expect(screen.getByText("تغيير الرقم")).toBeInTheDocument(),
      );
      await user.click(screen.getByText("تغيير الرقم"));
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });
});
