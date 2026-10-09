"use client";

import { useEffect, useState } from "react";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics";

export default function AnalyticsOptOut({ ar }: { ar: boolean }) {
  const [off, setOff] = useState(false);
  useEffect(() => setOff(isAnalyticsOptedOut()), []);
  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
      <input
        type="checkbox"
        className="h-5 w-5"
        checked={off}
        onChange={(e) => {
          setOff(e.target.checked);
          setAnalyticsOptOut(e.target.checked);
        }}
      />
      {ar ? "إيقاف تتبع الاستخدام المجهول على هذا الجهاز" : "Turn off anonymous usage analytics on this device"}
    </label>
  );
}
