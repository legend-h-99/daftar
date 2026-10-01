"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";

export default function PrivacyPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const sections = ar ? [
    ["البيانات المستخدمة", "يستخدم دفتر بيانات الحساب التي تقدمها عند التسجيل، وبيانات منشأتك، والسجلات التي تضيفها مثل الفواتير والمصاريف والمخزون وبيانات العملاء والموردين. تُستخدم هذه البيانات لتسجيل الدخول وعرض حسابات المنشأة وتقاريرها."],
    ["الخدمات التي تعالج البيانات", "تُستضاف واجهة الموقع على Cloudflare، ويعمل الخادم وقاعدة البيانات عبر البنية الخلفية المهيأة للتطبيق. عند اختيار الدخول عبر Google، تشارك Google بيانات الهوية اللازمة للدخول. لا تتضمن هذه الصفحة ضمانًا لاستضافة البيانات داخل دولة محددة."],
    ["التخزين في جهازك", "يحفظ المتصفح رمز جلسة الدخول وتفضيلات اللغة والمظهر في التخزين المحلي. إزالة بيانات الموقع من المتصفح تحذف النسخة المحلية، لكنها لا تحذف بيانات الحساب الموجودة على الخادم."],
    ["الاحتفاظ والحذف والتصدير", "لا تتوفر حاليًا في التطبيق آلية ذاتية لحذف الحساب أو تصدير جميع بياناته، ولم تُعلن مدة محددة للاحتفاظ بالبيانات والنسخ الاحتياطية. لا يعني تسجيل الخروج حذف حسابك أو سجلاتك."],
    ["حالة هذا الإشعار", "يوضح هذا الإشعار الحالة الحالية للتطبيق. لا تعرض هذه النسخة قناة مخصصة لطلبات الخصوصية. إذا كنت تحتاج إلى ترتيبات محددة للحذف أو الاحتفاظ أو موقع التخزين، انتظر توضيحها قبل إدخال بيانات حساسة. لا تضف بيانات أشخاص آخرين دون إذن مناسب."],
  ] : [
    ["Data used", "Daftar uses the account details you provide when registering, your business details, and records you add, such as invoices, expenses, inventory, and customer and supplier details. These support sign-in, business accounts and reports."],
    ["Services processing data", "Cloudflare hosts the website interface. The configured backend service and database process application data. If you choose Google sign-in, Google shares identity information needed to sign in. This notice does not guarantee storage in a particular country."],
    ["Storage on your device", "Your browser stores a session token and language and appearance preferences locally. Clearing site data removes the local copy; it does not delete account data stored on the server."],
    ["Retention, deletion and export", "The app does not currently provide self-service account deletion or a complete data export. A defined retention period for records and backups has not been published. Signing out does not delete your account or records."],
    ["Status of this notice", "This notice describes the current app. This version does not list a dedicated privacy request channel. If you require specific deletion, retention or storage-location arrangements, wait for clarification before entering sensitive data. Do not add another person's data without appropriate permission."],
  ];
  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background px-6 py-10 text-foreground">
      <article className="mx-auto max-w-2xl">
        <Link href="/login" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{ar ? "العودة لتسجيل الدخول" : "Back to sign in"}</Link>
        <h1 className="mt-5 text-2xl font-bold">{ar ? "إشعار الخصوصية — دفتر" : "Privacy notice — Daftar"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ar ? "آخر تحديث: 6 سبتمبر 2026" : "Last updated: 6 September 2026"}</p>
        {sections.map(([title, body]) => (
          <section key={title} className="mt-6">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-2 leading-8">{body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
