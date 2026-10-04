import React from "react";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { vi, describe, it, expect, beforeEach } from "vitest";

const businessState = { user: { id: "user-admin", name: "حسام المسملي", isAdmin: true } as Record<string, unknown> | null };
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("@/lib/language", () => ({ useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }) }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/lib/business-context", () => ({ useBusiness: () => ({ user: businessState.user, business: null }) }));
vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  },
}));

import { apiGet, apiPost, ApiError } from "@/lib/api";
import AdminPage from "@/app/(app)/admin/page";
import TopBar from "@/components/TopBar";

const overview = {
  users: 13, businesses: 12, onboardedUsers: 12, googleUsers: 9, unverifiedEmailUsers: 1,
  newUsers7d: 3, newUsers30d: 8, signupsByDay: [{ day: "2026-10-03", count: 2 }, { day: "2026-10-04", count: 1 }],
  activeBusinesses7d: 4, invoices: 40, invoices7d: 6, errors24h: 2,
  errorsByPath: [{ method: "GET", path: "/dashboard/summary", status: 503, count: 2, lastAt: "2026-10-04T08:00:00Z" }],
  recentAdminActions: [],
};

describe("لوحة إدارة المنصة", () => {
  beforeEach(() => {
    businessState.user = { id: "user-admin", name: "حسام المسملي", isAdmin: true };
    vi.mocked(apiGet).mockReset();
    vi.mocked(apiPost).mockReset();
  });

  it("يعرض أرقام المنصة وأخطاء الخادم للمدير", async () => {
    vi.mocked(apiGet).mockResolvedValue(overview);
    render(<AdminPage />);
    expect(await screen.findByText("أهلاً حسام")).toBeInTheDocument();
    expect(screen.getByText("المستخدمون").closest("div")).toHaveTextContent("13");
    expect(screen.getByText("أخطاء الخادم (24 ساعة)").closest("div")).toHaveTextContent("2");
    expect(screen.getByText("/dashboard/summary")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/admin/overview");
  });

  it("لا يعرض اللوحة لغير المدير", () => {
    businessState.user = { id: "u", name: "زبون", isAdmin: false };
    render(<AdminPage />);
    expect(screen.getByText("هذه الصفحة غير متاحة")).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("يبحث عن مستخدم ويرسل رابط تغيير كلمة المرور بعد التأكيد", async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) => path.startsWith("/admin/users")
      ? [{ id: "user-target", name: "زبون", email: "customer@example.invalid", emailVerified: true, google: false, hasPassword: true, businessName: "محل", invoiceCount: 3, createdAt: "2026-10-01T00:00:00Z" }]
      : overview);
    vi.mocked(apiPost).mockResolvedValue({ sent: true });
    render(<AdminPage />);
    await screen.findByText("أهلاً حسام");
    fireEvent.change(screen.getByLabelText("ابحث بالبريد أو اسم المحل"), { target: { value: "customer" } });
    fireEvent.click(screen.getByRole("button", { name: "بحث" }));
    expect(await screen.findByText("customer@example.invalid")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/admin/users?q=customer");
    expect(screen.queryByRole("button", { name: "إرسال رابط تأكيد البريد" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "إرسال رابط تغيير كلمة المرور" }));
    expect(apiPost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "اضغط مرة ثانية للإرسال" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/admin/users/user-target/password-reset", {}));
    expect(await screen.findByText("تم إرسال الرابط إلى customer@example.invalid")).toBeInTheDocument();
  });

  it("يعرض سبب رفض الإرسال", async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) => path.startsWith("/admin/users")
      ? [{ id: "user-x", email: "new@example.invalid", emailVerified: false, google: false, hasPassword: true, invoiceCount: 0, createdAt: "2026-10-01T00:00:00Z" }]
      : overview);
    vi.mocked(apiPost).mockRejectedValue(new ApiError("تعذر الإرسال", 503));
    render(<AdminPage />);
    await screen.findByText("أهلاً حسام");
    fireEvent.change(screen.getByLabelText("ابحث بالبريد أو اسم المحل"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "بحث" }));
    fireEvent.click(await screen.findByRole("button", { name: "إرسال رابط تأكيد البريد" }));
    fireEvent.click(screen.getByRole("button", { name: "اضغط مرة ثانية للإرسال" }));
    expect(await screen.findByText("تعذر الإرسال")).toBeInTheDocument();
  });
});

describe("رابط الإدارة في الشريط العلوي", () => {
  it("يظهر للمدير فقط", () => {
    businessState.user = { id: "user-admin", isAdmin: true };
    const { unmount } = render(<TopBar businessName="سوشي" />);
    expect(screen.getByRole("link", { name: "لوحة الإدارة" })).toHaveAttribute("href", "/admin");
    unmount();
    businessState.user = { id: "u", isAdmin: false };
    render(<TopBar businessName="سوشي" />);
    expect(screen.queryByRole("link", { name: "لوحة الإدارة" })).not.toBeInTheDocument();
  });
});
