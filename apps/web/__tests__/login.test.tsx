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

const mockSetToken = vi.fn();

vi.mock("@/lib/auth", () => ({
  setToken: (t: string) => mockSetToken(t),
  getToken: vi.fn(),
  usesSessionProxy: () => false,
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

// The email flow is behind a flag (off in production); these tests exercise it when enabled.
vi.hoisted(() => { process.env.NEXT_PUBLIC_EMAIL_LOGIN_ENABLED = "true"; });

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة تسجيل الدخول بدون رقم الجوال", () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
    mockFetch.mockResolvedValue(jsonResponse({ accessToken: "test-token", hasBusiness: true }));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "test@example.com");
    await user.type(screen.getByLabelText("كلمة المرور"), "password123");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"));
    expect(mockSetToken).toHaveBeenCalledWith("test-token");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/auth/email/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "test@example.com", password: "password123" }),
      }),
    );
  });

  it("ينشئ الحساب بالبريد دون طلب رقم جوال", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ sent: true }));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: "حساب جديد" }));
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "test@example.com");
    await user.type(screen.getByLabelText("كلمة المرور"), "password123");
    await user.click(screen.getByRole("button", { name: "إنشاء الحساب" }));
    expect(await screen.findByText("تم التسجيل بنجاح!")).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/auth/email/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "test@example.com", password: "password123" }),
      }),
    );
  });
});

describe("صفحة تسجيل الدخول عبر Google فقط", () => {
  it("يخفي نموذج البريد عندما لا يكون مفعّلاً", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN_ENABLED", "false");
    const { default: GoogleOnlyLoginPage } = await import("@/app/login/page");
    render(<GoogleOnlyLoginPage />);
    expect(screen.getByTestId("google-btn")).toBeInTheDocument();
    expect(screen.queryByLabelText("البريد الإلكتروني")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("كلمة المرور")).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
