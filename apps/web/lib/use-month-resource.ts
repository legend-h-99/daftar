"use client";

import { useEffect, useRef, useState } from "react";
import { currentMonthStr, shiftMonth } from "@/lib/format";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

interface UseMonthResourceOptions<T> {
  load: (month: string) => Promise<T>;
  errorMessage: (error: unknown) => string;
  cache?: Map<string, CacheEntry<T>>;
  staleMs?: number;
  cacheMax?: number;
}

export function useMonthResource<T>({
  load,
  errorMessage,
  cache,
  staleMs = 0,
  cacheMax = 6,
}: UseMonthResourceOptions<T>) {
  const loadRef = useRef(load);
  const errorMessageRef = useRef(errorMessage);
  const [month, setMonth] = useState(currentMonthStr());
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRef.current = load;
    errorMessageRef.current = errorMessage;
  }, [errorMessage, load]);

  useEffect(() => {
    let cancelled = false;
    const cached = cache?.get(month);
    const cacheIsFresh = cached && Date.now() - cached.ts <= staleMs;

    if (cached) {
      setData(cached.data);
      setLoading(false);
      setError(null);
    } else {
      setData(null);
      setLoading(true);
      setError(null);
    }

    if (cacheIsFresh && retryKey === 0) {
      return () => {
        cancelled = true;
      };
    }

    loadRef.current(month)
      .then((nextData) => {
        if (cancelled) return;
        if (cache) {
          cache.set(month, { data: nextData, ts: Date.now() });
          // Evict oldest entries beyond cacheMax
          if (cache.size > cacheMax) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
        }
        setData(nextData);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!cached) {
          setError(errorMessageRef.current(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cache, month, retryKey, staleMs]);

  return {
    month,
    setMonth,
    data,
    error,
    loading,
    isCurrentMonth: month === currentMonthStr(),
    previousMonth: () => setMonth((m) => shiftMonth(m, -1)),
    nextMonth: () => setMonth((m) => shiftMonth(m, 1)),
    reload: () => setRetryKey((key) => key + 1),
  };
}
