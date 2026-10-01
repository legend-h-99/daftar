"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Phone (SMS) sign-in is not offered; old links land on the email/Google login. */
export default function OtpRedirect() {
  const router = useRouter();
  useEffect(() => {
    try { sessionStorage.removeItem("daftar_otp_flow"); } catch {}
    router.replace("/login");
  }, [router]);
  return null;
}
