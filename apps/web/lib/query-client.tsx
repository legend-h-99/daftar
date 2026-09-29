"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ComponentType, type ReactNode } from "react";

// Keep the provider compatible when the workspace resolves more than one
// @types/react version during the Cloudflare build.
const CompatibleQueryClientProvider = QueryClientProvider as unknown as ComponentType<{
  client: QueryClient;
  children?: ReactNode;
}>;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,      // 30 ثانية قبل إعادة الطلب
            gcTime: 5 * 60_000,     // 5 دقائق في الكاش
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return <CompatibleQueryClientProvider client={client}>{children}</CompatibleQueryClientProvider>;
}
