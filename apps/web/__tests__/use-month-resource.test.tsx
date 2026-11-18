import { render, screen, waitFor } from "@/test/test-utils";
import React from "react";
import { vi, describe, it, expect } from "vitest";
import type { DashboardSummary } from "@/lib/types";

// ── Static mocks ─────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: { href: string; children: React.ReactNode } & React.HTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/language", () => ({
  useLanguage: () => ({ language: "ar", toggleLanguage: vi.fn() }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// الوضع التجريبي الحقيقي: apiGet الحقيقي يمر عبر demoApiFetch الحقيقي
vi.mock("@/lib/demo-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demo-api")>();
  return { ...actual, DEMO_MODE: true };
});

// ── Imports (after mocks) ────────────────────────────────────────────────────

import InvoicesPage from "@/app/(app)/invoices/page";
import { apiGet } from "@/lib/api";
import { useMonthResource } from "@/lib/use-month-resource";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Every function this factory returns has the same source text, which is what
// made the dashboard and invoices loaders collide after compilation.
function makeLoad<T>(data: T) {
  return (_month: string) => Promise.resolve(data);
}

function Probe<T>({ resourceKey, load, testId }: {
  resourceKey: string;
  load: (month: string) => Promise<T>;
  testId: string;
}) {
  const { data } = useMonthResource<T>({ key: resourceKey, load, errorMessage: () => "error" });
  return <pre data-testid={testId}>{data === null ? "loading" : JSON.stringify(data)}</pre>;
}

// Mirrors the dashboard page's loader — it runs first after demo login.
function DashboardProbe() {
  const { data } = useMonthResource<DashboardSummary>({
    key: "dashboard",
    load: (targetMonth) => apiGet<DashboardSummary>(`/dashboard/summary?month=${targetMonth}`),
    errorMessage: () => "error",
  });
  return <p data-testid="dashboard">{data ? "dashboard-ready" : "dashboard-loading"}</p>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useMonthResource", () => {
  it("يفصل كاش كل مورد حتى لو تطابق نص دالة التحميل", async () => {
    const summary = { totalSales: 100 };
    const invoices = [{ id: "inv-1" }];
    const loadSummary = makeLoad(summary);
    const loadInvoices = makeLoad(invoices);
    expect(loadSummary.toString()).toBe(loadInvoices.toString());

    const { rerender } = render(
      <Probe resourceKey="dashboard" load={loadSummary} testId="dashboard" />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("dashboard")).toHaveTextContent(JSON.stringify(summary)),
    );

    // Navigating to a second page keeps the same QueryClient (same render tree).
    rerender(
      <>
        <Probe resourceKey="dashboard" load={loadSummary} testId="dashboard" />
        <Probe resourceKey="invoices" load={loadInvoices} testId="invoices" />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("invoices")).toHaveTextContent(JSON.stringify(invoices)),
    );
  });
});

describe("صفحة الفواتير في الوضع التجريبي", () => {
  it("تستلم مصفوفة الفواتير بعد تحميل ملخص اللوحة لنفس الشهر", async () => {
    const { rerender } = render(<DashboardProbe />);
    await waitFor(() =>
      expect(screen.getByTestId("dashboard")).toHaveTextContent("dashboard-ready"),
    );

    rerender(
      <>
        <DashboardProbe />
        <InvoicesPage />
      </>,
    );

    await waitFor(() => expect(screen.getByText("نورة العتيبي")).toBeInTheDocument());
    expect(screen.getByText("سارة محمد")).toBeInTheDocument();
    expect(screen.getByText("هدى خالد")).toBeInTheDocument();
    expect(screen.getByText("إجمالي 3 فاتورة")).toBeInTheDocument();
  });
});
