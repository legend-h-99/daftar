# Architecture — دفتر

## Product Overview

دفتر منصة حسابات عربية للأسر المنتجة والمشاريع الصغيرة جدًا. التجربة الأساسية: تسجيل دخول برقم الجوال، إنشاء نشاط، إدارة مواد ومنتجات ووصفات، إنشاء فواتير، تسجيل مصاريف ومشتريات، متابعة المخزون، ورؤية لوحة ربح.

## Tech Stack

| Layer | Implementation |
|---|---|
| Web | Next.js 15 + React 19 + Tailwind + shadcn/Base UI |
| Mobile | Expo Router + React Native + React Query + SecureStore |
| API | NestJS 10 + Prisma + PostgreSQL |
| Auth | OTP + JWT + TokenBlacklist |
| PDF | pdfkit |
| Scheduling | NestJS Schedule for blacklist cleanup |
| Database | Prisma schema with business-scoped models |

## Key API Modules

Auth, Business, Materials, Products, Customers, Invoices, Expenses, Dashboard, Suppliers, Inventory, Purchases, Cleanup.

## Auth / Session Flow

1. المستخدم يطلب OTP برقم سعودي.
2. `AuthService` يطبع/يرجع الرمز فقط إذا `AUTH_DEV_OTP=true` و`NODE_ENV` development/test.
3. في الإنتاج الحالي يوجد TODO لإرسال الرمز عبر مزود فعلي.
4. عند التحقق، يتم `upsert` للمستخدم وتوقيع JWT لمدة 30 يومًا.
5. `JwtStrategy` يرفض token إذا كان `jti` موجودًا في `TokenBlacklist`.
6. `logout` يضيف `jti` للقائمة السوداء.
7. `CleanupService` يحذف الإدخالات المنتهية يوميًا 3 صباحًا.

## Trust Boundaries

| Boundary | From | To | Risk | Enforcement |
|---|---|---|---|---|
| Browser/Mobile -> API | User client | NestJS | طلبات غير مصرح بها | JwtAuthGuard |
| User -> Business data | Authenticated user | business resources | tenant data leakage | businessId + BusinessGuard + service filters |
| API -> DB | NestJS | PostgreSQL | بيانات خاطئة أو غير معزولة | Prisma + businessId |
| API -> OTP Provider | AuthService | SMS/WhatsApp | تسريب رمز/فشل إرسال | لم ينفذ بعد |
| API -> OCR | Purchases OCR | Provider | استخراج خاطئ | provider interface + يجب تأكيد بشري |

## Known Risks / Assumptions

| Risk | Evidence | Mitigation |
|---|---|---|
| OTP production not wired | `AuthService` TODO | تنفيذ قناة WhatsApp/SMS |
| Tenant isolation depends on service filters | schema uses businessId | اختبار كل endpoint |
| No full ZATCA compliance | product docs exclude it | copy guardrails |
| PII under PDPL | phone/customer/supplier data | privacy policy + deletion/export |

## Related Documents

- [flows.md](flows.md)
- [permissions.md](permissions.md)
- [variables.md](variables.md)
- [tests.md](tests.md)

