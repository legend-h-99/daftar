"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, useState, type ReactNode } from "react";

// Keep the provider compatible when the workspace resolves more than one
// @types/react version during the Cloudflare build.
const CompatibleQueryClientProvider: any = QueryClientProvider;

export function QueryProvider({ children }: { children: ReactNode }): any {
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
  return createElement(CompatibleQueryClientProvider, { client, children }) as unknown as ReactNode;
}
