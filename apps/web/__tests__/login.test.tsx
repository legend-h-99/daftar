import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

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

describe("صفحة تسجيل الدخول بدون رقم الجوال", () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset();
    mockReplace.mockReset();
    mockSetToken.mockReset();
  });

  it("يعرض البريد وGoogle دون خيار الجوال", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByLabelText("كلمة المرور")).toBeInTheDocument();
    expect(screen.getByTestId("google-btn")).toBeInTheDocument();
    expect(screen.queryByText("رقم الجوال")).not.toBeInTheDocument();
    expect(screen.queryByText("إرسال رمز التحقق")).not.toBeInTheDocument();
  });

  it("يسجل الدخول بالبريد ويوجه للوحة التحكم", async () => {
    vi.mocked(apiPost).mockResolvedValue({ accessToken: "test-token", hasBusiness: true });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "test@example.com");
    await user.type(screen.getByLabelText("كلمة المرور"), "password123");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    expect(apiPost).toHaveBeenCalledWith("/auth/email/login", { email: "test@example.com", password: "password123" });
    expect(mockSetToken).toHaveBeenCalledWith("test-token");
  });

  it("ينشئ الحساب بالبريد دون طلب رقم جوال", async () => {
    vi.mocked(apiPost).mockResolvedValue({ sent: true });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "حساب جديد" }));
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "test@example.com");
    await user.type(screen.getByLabelText("كلمة المرور"), "password123");
    await user.click(screen.getByRole("button", { name: "إنشاء الحساب" }));
    expect(await screen.findByText("تم التسجيل بنجاح!")).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith("/auth/email/register", { email: "test@example.com", password: "password123", name: undefined });
  });
});
