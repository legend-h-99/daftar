"use client";

import { useEffect, useState } from "react";

function monthLabel() {
  return new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric" });
}

/** Current Gregorian month in Arabic. Computed on the client so the static export never shows a stale month. */
export default function CurrentMonth() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => setLabel(monthLabel()), []);
  return <>{label ?? "هذا الشهر"}</>;
}
