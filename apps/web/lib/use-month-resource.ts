"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { currentMonthStr, shiftMonth } from "@/lib/format";

interface UseMonthResourceOptions<T> {
  load: (month: string) => Promise<T>;
  errorMessage: (error: unknown) => string;
  /** محتفظ بها للتوافق مع الكود القديم — React Query يتولى الكاش */
  cache?: Map<string, { data: T; ts: number }>;
  staleMs?: number;
  cacheMax?: number;
}

export function useMonthResource<T>({
  load,
  errorMessage,
  staleMs = 30_000,
}: UseMonthResourceOptions<T>) {
  const [month, setMonth] = useState(currentMonthStr());

  const { data, error, isLoading, refetch } = useQuery<T, unknown>({
    queryKey: ["month-resource", month, load.toString().slice(0, 60)],
    queryFn: () => load(month),
    staleTime: staleMs,
    gcTime: 5 * 60_000,
  });

  return {
    month,
    setMonth,
    data: data ?? null,
    error: error ? errorMessage(error) : null,
    loading: isLoading,
    isCurrentMonth: month === currentMonthStr(),
    previousMonth: () => setMonth((m) => shiftMonth(m, -1)),
    nextMonth: () => setMonth((m) => shiftMonth(m, 1)),
    reload: () => refetch(),
  };
}
