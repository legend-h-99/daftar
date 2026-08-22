import type { Metadata } from "next";
import LandingContent from "./landing/_content";
import AuthRedirect from "./_auth-redirect";

export const metadata: Metadata = {
  title: "دفتر — تطبيق محاسبة للمشاريع الصغيرة | Daftar",
  description:
    "تطبيق محاسبة عربي مبسّط للأسر المنتجة والمشاريع الصغيرة في السعودية. تابع مبيعاتك ومصاريفك وفواتيرك وأرباحك من مكان واحد — بدون مصطلحات محاسبية. جرّب مجانًا.",
};

export default function RootPage() {
  return (
    <>
      <AuthRedirect />
      <LandingContent />
    </>
  );
}
