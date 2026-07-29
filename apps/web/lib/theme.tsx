"use client";

import { ReactNode } from "react";

// Theme system removed — دفتر uses a single fixed brand palette (#0f7353).
// ThemeProvider kept as a transparent passthrough for layout compatibility.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
