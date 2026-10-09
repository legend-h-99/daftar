"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { Sentry.captureException(error); }, [error]);

  // The root layout/providers/CSS may have failed, so this screen is self-contained.
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#172033" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24, textAlign: "center" }}>
          <h1>تعذر عرض الصفحة</h1>
          <p>حاول مرة أخرى. إذا استمرت المشكلة، أعد تحميل الصفحة.</p>
          <p lang="en" dir="ltr">Could not display this page. Try again or reload the page.</p>
          <button onClick={reset} style={{ minHeight: 44, padding: "12px 24px", cursor: "pointer" }}>حاول مرة أخرى / Try again</button>
          {/* Full navigation recovers even when the root layout/router failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ display: "inline-block", padding: 14 }}>العودة للرئيسية / Home</a>
        </main>
      </body>
    </html>
  );
}
