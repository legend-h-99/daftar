# Flows — دفتر

| Flow | Actor | Preconditions | Steps | Authz Check | Side Effects | Deny Case |
|---|---|---|---|---|---|---|
| طلب OTP | زائر | رقم جوال | requestOtp -> generate code -> store OtpCode | throttle global + dev OTP guard | إنشاء OtpCode وإبطال القديم | لا يرجع devCode إلا في dev/test |
| تحقق OTP | زائر | OTP صالح | verifyOtp -> consume code -> upsert user -> sign JWT | code TTL + attempts | JWT + user | Invalid/expired after failures |
| إنشاء نشاط | مستخدم | JWT دون business | create business | JwtAuthGuard | Business + user.businessId | رفض إذا token غير صالح |
| إدارة مواد/منتجات | مستخدم له business | businessId في JWT | create/update material/product | JwtAuthGuard + BusinessGuard + businessId filter | rows scoped by businessId | رفض onboarding incomplete |
| إنشاء فاتورة | مستخدم له business | customer/product optional | create invoice + items | business scope | Invoice/InvoiceItem وربما stock movement | لا يرى أعمال أخرى |
| تسجيل مصروف | مستخدم له business | category/amount/date | create expense | business scope | Expense row | reject invalid DTO |
| شراء/OCR | مستخدم له business | receipt/manual purchase | parse/review/create purchase | business scope | Purchase/PurchaseItem/StockMovement | لا حفظ OCR دون تأكيد |
| Logout | مستخدم | JWT | decode jti -> blacklist | bearer token | TokenBlacklist row | no-op إذا لا jti |
| Cleanup | النظام | schedule | delete expired blacklist rows | internal cron | حذف rows منتهية | لا endpoint عام |

