"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "./api";
import { useLanguage } from "./language";

/**
 * hook عام لطلبات GET مع React Query.
 * يُفعّل الكاش، stale-while-revalidate، وإعادة المحاولة تلقائياً.
 */
export function useApiGet<T>(
  queryKey: unknown[],
  path: string,
  options?: { enabled?: boolean; staleTime?: number },
) {
  const { language } = useLanguage();
  return useQuery<T, ApiError>({
    queryKey,
    queryFn: () => apiGet<T>(path),
    staleTime: options?.staleTime ?? 30_000,
    enabled: options?.enabled ?? true,
    meta: { language },
  });
}

/**
 * hook لطلبات POST / PATCH / DELETE مع إبطال كاش تلقائي.
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKeys?: unknown[][],
) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => {
      invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

export { apiPost, apiPatch, apiDelete };
