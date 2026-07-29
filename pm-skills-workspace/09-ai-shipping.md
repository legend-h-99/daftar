# 09 AI Shipping — دفتر

## Current Shipping State

دفتر يملك تطبيقًا فعليًا: Web، Mobile، API، وقاعدة بيانات. الشحن الناعم ممكن بعد إغلاق فجوات إنتاج محددة، أهمها OTP الحقيقي، إعداد الأسرار، سياسة الخصوصية، والمراقبة.

## Core Documents

- [documentation/architecture.md](documentation/architecture.md)
- [documentation/flows.md](documentation/flows.md)
- [documentation/permissions.md](documentation/permissions.md)
- [documentation/variables.md](documentation/variables.md)
- [documentation/tests.md](documentation/tests.md)

## Conditional Documents Needed

- `cron.md`: يوجد scheduled cleanup لحذف TokenBlacklist المنتهي.
- `automation.md`: يوجد OCR provider للمشتريات، حاليًا mock/واجهة provider.
- `seo.md`: landing page عامة موجودة في web.
- `emails.md`: غير مطلوب الآن؛ لا تظهر رسائل بريد في الكود الحالي.

## Intended Vs Implemented Audit

| Documented Intent | Implementation Evidence | Match? | Risk If Mismatch | Fix |
|---|---|---|---|---|
| OTP حقيقي في الإنتاج | AuthService فيه TODO لمزود SMS/WhatsApp، وAUTH_DEV_OTP محمي للتطوير | جزئي | تسجيل لا يصل للمستخدم الحقيقي | تنفيذ OtpChannel إنتاجي |
| عزل بيانات كل نشاط | كل النماذج businessId + BusinessGuard يضمن وجود businessId | جزئي | خطر قراءة أعمال أخرى إذا service لا يفلتر | مراجعة كل service لفلاتر businessId |
| عدم ادعاء ZATCA | الوثائق تقول لا ادعاء امتثال | مطابق وثائقيًا | خطر قانوني وتسويقي | مراجعة copy قبل الإطلاق |
| JWT قابل للإلغاء | TokenBlacklist + logout + cleanup | مطابق | جلسات مسروقة تبقى فعالة | تأكد أن كل clients تستخدم logout |
| مخزون قابل للتدقيق | StockMovement append-only | مطابق جزئيًا | رصيد غير قابل للتفسير | اختبارات ledger |
| OCR بتأكيد بشري | يوجد OCR provider/mocks | غير مؤكد | حفظ بيانات خاطئة | لا حفظ تلقائي دون مراجعة |

## Shipping Decision

- [ ] OTP production provider.
- [ ] سياسة خصوصية عربية منشورة.
- [ ] Sentry + PostHog.
- [ ] نسخة احتياطية واستعادة مجربة.
- [ ] مراجعة فلاتر `businessId` في كل service.
- [ ] اختبارات المسار الحرج على جهاز حقيقي.
- [ ] نصوص واضحة: دفتر ليس مستشارًا ضريبيًا وليس معتمد ZATCA.

