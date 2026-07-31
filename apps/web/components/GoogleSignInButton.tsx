"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiPost } from "@/lib/api";
import { setToken } from "@/lib/auth";

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

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function GoogleSignInButton() {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const renderedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId || renderedRef.current) return;

    function renderGoogleButton(googleClientId: string) {
      if (!buttonRef.current || !window.google || renderedRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            setError("تعذر استلام بيانات Google");
            return;
          }
          setError(null);
          try {
            const res = await apiPost<{ accessToken: string; hasBusiness: boolean }>(
              "/auth/google",
              { credential: response.credential },
            );
            setToken(res.accessToken);
            router.replace(res.hasBusiness ? "/dashboard" : "/onboarding");
          } catch (err) {
            setError(err instanceof ApiError ? err.message : "تعذر تسجيل الدخول عبر Google");
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        locale: "ar",
        width: 304,
      });
      renderedRef.current = true;
    }

    if (window.google) {
      renderGoogleButton(clientId);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=ar";
    script.async = true;
    script.defer = true;
    script.onload = () => renderGoogleButton(clientId);
    script.onerror = () => setError("تعذر تحميل تسجيل الدخول عبر Google");
    document.head.appendChild(script);
  }, [router]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="rounded-xl bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
        تسجيل الدخول عبر Google يحتاج ضبط NEXT_PUBLIC_GOOGLE_CLIENT_ID
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
