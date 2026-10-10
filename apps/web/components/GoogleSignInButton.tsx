"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { track } from "@/lib/analytics";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              type?: "standard" | "icon";
              shape?: "rectangular" | "pill" | "circle" | "square";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              locale?: string;
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "269103980010-fbvbr60h67qh60j8cbib2a9agle2087n.apps.googleusercontent.com";

let gsiScriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        gsiScriptPromise = null;
        reject(new Error("gsi-load-failed"));
      };
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

export default function GoogleSignInButton() {
  const router = useRouter();
  const { language } = useLanguage();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Load the GSI script and call initialize() exactly once per page (Google
  // logs a warning and only honors the last call if initialize() runs more
  // than once), then render/re-render the button whenever the container or
  // language changes.
  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !window.google) return;
        if (!initializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (!response.credential) {
                track("login_failed", { method: "google", status: 400 });
                setError(language === "ar" ? "تعذر استلام بيانات Google" : "Could not receive Google sign-in data");
                return;
              }
              setError(null);
              track("login_started", { method: "google" });
              try {
                const res = await apiPost<{ accessToken?: string; sessionAuthenticated?: boolean; hasBusiness: boolean; isNewUser?: boolean }>(
                  "/auth/google",
                  { credential: response.credential },
                );
                setToken(res.accessToken, res.sessionAuthenticated);
                if (res.isNewUser) track("user_signed_up", { method: "google" });
                track("user_signed_in", { method: "google", has_business: res.hasBusiness });
                router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
              } catch (err) {
                track("login_failed", { method: "google", status: err instanceof ApiError ? err.status : 0 });
                setError(
                  err instanceof ApiError
                    ? err.message
                    : language === "ar"
                      ? "تعذر تسجيل الدخول عبر Google"
                      : "Could not sign in with Google",
                );
              }
            },
          });
          initializedRef.current = true;
        }

        if (buttonRef.current) {
          buttonRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            shape: "rectangular",
            text: "continue_with",
            locale: language,
            width: 304,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          track("login_failed", { method: "google", status: 0 });
          setError(language === "ar" ? "تعذر تحميل تسجيل الدخول عبر Google" : "Could not load Google sign-in");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, language]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="rounded-xl bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
        {language === "ar"
          ? "تسجيل الدخول عبر Google يحتاج ضبط NEXT_PUBLIC_GOOGLE_CLIENT_ID"
          : "Google sign-in requires NEXT_PUBLIC_GOOGLE_CLIENT_ID to be set"}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={buttonRef} className="flex min-h-11 justify-center" />
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
