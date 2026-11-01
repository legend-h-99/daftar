import { render, screen } from "@/test/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { describe, expect, it } from "vitest";
import { useMonthResource } from "@/lib/use-month-resource";

function Probe({ load }: { load: (month: string) => Promise<string> }) {
  const { data } = useMonthResource<string>({ load, errorMessage: () => "error" });
  return <p>{data ?? "loading"}</p>;
}

describe("useMonthResource", () => {
  it("keeps two pages apart when their loaders start with the same 60+ characters", async () => {
    // Compiled loaders look like this in development: same long prefix, different request.
    const loadSummary = (month: string) => Promise.resolve(`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa summary ${month}`.slice(-16));
    const loadInvoices = (month: string) => Promise.resolve(`aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa invoices ${month}`.slice(-17));
    expect(loadSummary.toString().slice(0, 60)).toBe(loadInvoices.toString().slice(0, 60));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrap = (ui: React.ComponentProps<typeof QueryClientProvider>["children"]) => (
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    );

    const { unmount } = render(wrap(<Probe load={loadSummary} />));
    await screen.findByText(/^summary /);
    unmount();

    render(wrap(<Probe load={loadInvoices} />));
    expect(await screen.findByText(/^invoices /)).toBeInTheDocument();
    expect(screen.queryByText(/^summary /)).not.toBeInTheDocument();
  });
});
