import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";
import ForgotPasswordPage from "@/app/forgot-password/page";
import ResetPasswordPage from "@/app/reset-password/page";
import VerifyEmailPage from "@/app/verify-email/page";
import { apiPost } from "@/lib/api";

vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams("token=test-token") }));
vi.mock("@/lib/api", () => ({ apiPost: vi.fn().mockResolvedValue({}), ApiError: class extends Error {} }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("email-only routes", () => {
  it.each([ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage])("does not mount disabled email flows or submit a verification token", Page => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN_ENABLED", "false");
    render(<Page />);
    expect(screen.getByRole("heading", { name: "سجّل الدخول باستخدام Google" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "العودة لتسجيل الدخول" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("retains the recovery form when email authentication is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN_ENABLED", "true");
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إرسال رابط إعادة التعيين" })).toBeInTheDocument();
  });

  it("retains the reset form when email authentication is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_EMAIL_LOGIN_ENABLED", "true");
    render(<ResetPasswordPage />);
    expect(screen.getByLabelText("كلمة المرور الجديدة")).toBeInTheDocument();
  });
});
