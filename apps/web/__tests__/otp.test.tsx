import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockReplace = vi.fn();

// Stable like Next's router: the page reads its flow in an effect keyed on the router.
vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: (href: string) => mockReplace(href) };
  return { useRouter: () => router };
});

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
}));

const mockSetToken = vi.fn();

vi.mock("@/lib/auth", () => ({
  setToken: (token?: string, sessionAuthenticated?: boolean) => mockSetToken(token, sessionAuthenticated),
  getToken: vi.fn(),
  usesSessionProxy: () => false,
  clearToken: vi.fn(),
}));

vi.mock("@/lib/demo-api", () => ({ DEMO_MODE: false, DEMO_TOKEN: "demo", demoApiFetch: vi.fn() }));

import OtpPage from "@/app/otp/page";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function startFlow(flow: Record<string, unknown>) {
  sessionStorage.setItem("daftar_otp_flow", JSON.stringify(flow));
}

describe("صفحة رمز التحقق بالجوال", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockReplace.mockReset();
    mockSetToken.mockReset();
    sessionStorage.clear();
  });

  it("يعيد إلى صفحة الدخول إذا لم يُطلب رمز", async () => {
    render(<OtpPage />);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("يعرض عدد خانات الرمز الذي حدده الخادم", async () => {
    startFlow({ phone: "+966551234567", codeLength: 4 });
    render(<OtpPage />);
    await waitFor(() => expect(screen.getAllByLabelText(/من رمز التحقق/)).toHaveLength(4));
    expect(screen.getByText("+966551234567")).toBeInTheDocument();
  });

  it("يتحقق من الرمز ويدخل المستخدم الجديد إلى الإعداد", async () => {
    startFlow({ phone: "+966551234567", codeLength: 6 });
    mockFetch.mockResolvedValue(jsonResponse({ accessToken: "phone-token", hasBusiness: false, isNewUser: true }));
    const user = userEvent.setup();
    render(<OtpPage />);
    const [first] = await screen.findAllByLabelText(/من رمز التحقق/);
    await user.click(first);
    await user.paste("123456");

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
    expect(mockSetToken).toHaveBeenCalledWith("phone-token", undefined);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/auth/otp/verify",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ phone: "+966551234567", code: "123456" }) }),
    );
    expect(sessionStorage.getItem("daftar_otp_flow")).toBeNull();
  });

  it("يوضح أن الرمز خاطئ دون أن يسجل الدخول", async () => {
    startFlow({ phone: "+966551234567", codeLength: 6 });
    mockFetch.mockResolvedValue(jsonResponse({ message: "Invalid or expired verification code", statusCode: 401 }, 401));
    const user = userEvent.setup();
    render(<OtpPage />);
    const [first] = await screen.findAllByLabelText(/من رمز التحقق/);
    await user.click(first);
    await user.paste("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("الرمز غير صحيح أو انتهت صلاحيته");
    expect(mockSetToken).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
