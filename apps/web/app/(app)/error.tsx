"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">حدث خطأ غير متوقع</h2>
        <p className="mt-1 text-sm text-gray-500">Something went wrong. Please try again.</p>
      </div>
      <button
        onClick={reset}
        className="rounded-2xl bg-brand-700 px-6 py-2.5 text-sm font-bold text-white active:bg-brand-800"
      >
        حاول مرة ثانية / Try again
      </button>
    </div>
  );
}
