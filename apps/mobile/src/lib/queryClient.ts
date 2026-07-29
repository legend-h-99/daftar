import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minutes stale — suits short mobile sessions
      staleTime: 5 * 60 * 1000,
      // Retry once on transient failures, then surface the error
      retry: 1,
      retryDelay: 1500,
    },
    mutations: {
      retry: 0,
    },
  },
});
