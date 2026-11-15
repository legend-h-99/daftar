"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/language";
import DataExport from "@/components/DataExport";
import AccountDeletionRequest from "@/components/AccountDeletionRequest";
import SupportLink from "@/components/SupportLink";
import AnalyticsOptOut from "@/components/AnalyticsOptOut";

export default function PrivacyPage() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const sections = ar ? [
    ["البيانات المستخدمة", "يستخدم دفتر بيانات الحساب التي تقدمها عند التسجيل، وبيانات منشأتك، والسجلات التي تضيفها مثل الفواتير والمصاريف والمخزون وبيانات العملاء والموردين. تُستخدم هذه البيانات لتسجيل الدخول وعرض حسابات المنشأة وتقاريرها."],
    ["الخدمات التي تعالج البيانات", "تعمل قاعدة البيانات والخدمات الخلفية عبر Supabase، وتُستضاف واجهة الموقع على Cloudflare، ويُرسل Resend رسائل البريد الخاصة بالتحقق وإعادة تعيين كلمة المرور. عند اختيار الدخول عبر Google، تشارك Google بيانات الهوية اللازمة للدخول. وعند تفعيل الدخول برقم الجوال، يُرسل رقمك إلى Authentica (أوثنتيكا)، مزود سعودي لرسائل التحقق، لإرسال رمز الدخول والتحقق منه فقط. ويسجّل Sentry أخطاء التطبيق، وتُخفى النصوص في تسجيلات الجلسة. لا تتضمن هذه الصفحة ضمانًا لاستضافة البيانات داخل دولة محددة."],
    ["تتبع الاستخدام","يرسل دفتر إلى قاعدة التطبيق في Supabase أحداث استخدام عامة (مثل: فتح الصفحة، إنشاء فاتورة، إضافة مصروف) مع معرّف عشوائي لجهازك لتحسين التطبيق. هذا المعرّف بيانات شخصية مستعارة، وليس مجهولًا. لا تتضمن هذه الأحداث اسمك أو بريدك أو أي مبلغ أو نص تكتبه. تُحتفظ الأحداث لمدة 30 يومًا وتُحذف الأحداث الأقدم عند استقبال حدث جديد أو فتح ملخص التحليلات. القياس لا يربط الأحداث بحسابك. يمكنك إيقافها من الخيار أسفل هذه الصفحة، كما يحترم التطبيق إعداد «عدم التتبع» في متصفحك."],
    ["التخزين في جهازك", "يحفظ المتصفح جلسة الدخول في ملف ارتباط آمن لا تستطيع برامج الصفحة قراءته. تُحفظ تفضيلات اللغة والمظهر ومؤشر غير سري لحالة الدخول في التخزين المحلي. إزالة بيانات الموقع من المتصفح تحذف النسخة المحلية، لكنها لا تحذف بيانات الحساب الموجودة على الخادم."],
    ["الاحتفاظ والحذف والتصدير", "يمكن للمستخدم المسجل تنزيل بيانات حسابه وسجلات نشاطه من زر التصدير أدناه. ويمكنه طلب حذف حسابه من الزر أدناه، فيُسجَّل الطلب ويُراجع يدويًا بعد التحقق من هوية صاحب الحساب والالتزامات المرتبطة بالسجلات الضريبية. تُحذف روابط التحقق وإعادة تعيين كلمة المرور بعد 7 أيام من انتهائها، وسجلات محاولات الدخول بعد يوم واحد. لم تُعلن بعد مدة الاحتفاظ بسجلات النشاط والنسخ الاحتياطية. لا يعني تسجيل الخروج حذف حسابك أو سجلاتك."],
    ["طلبات المساعدة والخصوصية", "يمكن إرسال طلبات المساعدة أو الخصوصية أو حذف الحساب إلى info@daftar1.com. تُراجع طلبات الحذف يدويًا بعد التحقق من هوية صاحب الحساب والالتزامات المرتبطة بالسجلات. لا تضف بيانات أشخاص آخرين دون إذن مناسب."],
  ] : [
    ["Data used", "Daftar uses the account details you provide when registering, your business details, and records you add, such as invoices, expenses, inventory, and customer and supplier details. These support sign-in, business accounts and reports."],
    ["Services processing data", "Supabase runs the database and backend services. Cloudflare hosts the website. Resend delivers verification and password-reset emails. If you choose Google sign-in, Google shares identity information needed to sign in. When phone sign-in is enabled, your number is sent to Authentica, a Saudi verification provider, only to send and check your sign-in code. Sentry records application errors, and its session replays mask text. This notice does not guarantee storage in a particular country."],
    ["Usage analytics","Daftar sends general usage events to its application database in Supabase (such as page views, invoice created, expense added) with a random device identifier to improve the app. This identifier is pseudonymous personal data, not anonymous data. These events never include your name, email, any amount, or text you type. Events are retained for 30 days; older events are pruned when new events arrive or the analytics summary is opened. Events are not linked to your account. You can turn them off below, and the app also respects your browser's Do Not Track setting."],
    ["Storage on your device", "Your browser stores the session in a secure cookie that page scripts cannot read. Language and appearance preferences and a non-secret sign-in indicator are stored locally. Clearing site data removes the local copy; it does not delete account data stored on the server."],
    ["Retention, deletion and export", "Signed-in users can download their account profile and business records with the export button below. They can also request deletion of their account with the button below; the request is recorded and reviewed manually after verifying ownership and any tax record obligations. Verification and password-reset links are deleted 7 days after they expire, and sign-in attempt records after one day. A retention period for business records and backups has not yet been published. Signing out does not delete your account or records."],
    ["Help and privacy requests", "Send support, privacy or account deletion requests to info@daftar1.com. Deletion requests are reviewed manually after verifying account ownership and applicable record obligations. Do not add another person's data without appropriate permission."],
  ];
  return (
    <main dir={ar ? "rtl" : "ltr"} className="min-h-screen bg-background px-6 py-10 text-foreground">
      <article className="mx-auto max-w-2xl">
        <Link href="/login" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">{ar ? "العودة لتسجيل الدخول" : "Back to sign in"}</Link>
        <h1 className="mt-5 text-2xl font-bold">{ar ? "إشعار الخصوصية — دفتر" : "Privacy notice — Daftar"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{ar ? "آخر تحديث: 15 نوفمبر 2026" : "Last updated: 15 November 2026"}</p>
        {sections.map(([title, body]) => (
          <section key={title} className="mt-6">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-2 leading-8">{body}</p>
          </section>
        ))}
        <DataExport ar={ar} />
        <AccountDeletionRequest ar={ar} />
        <SupportLink ar={ar} />
        <AnalyticsOptOut ar={ar} />
      </article>
    </main>
  );
}
