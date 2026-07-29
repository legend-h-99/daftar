# Variables — دفتر

| Name | Used By | Scope | Source | Rotation | Risk |
|---|---|---|---|---|---|
| `DATABASE_URL` | API/Prisma | server | hosting secret | عند الاشتباه | وصول كامل للبيانات |
| `JWT_SECRET` | API auth | server | hosting secret | دوري/حادث | تزوير جلسات |
| `AUTH_DEV_OTP` | API auth | server | env | يجب false في prod | تسريب OTP إذا خطأ |
| `NODE_ENV` | API | server | deploy env | n/a | dev features in prod |
| `CORS_ORIGIN` | API | server | env | عند تغيير النطاق | فتح API لمصدر خاطئ |
| `NEXT_PUBLIC_API_URL` | Web | client public | Vercel env | عند تغيير API | public وليس secret |
| `EXPO_PUBLIC_API_URL` | Mobile | client public | Expo env | عند تغيير API | public وليس secret |
| OTP provider token | API | server | provider secret | دوري/حادث | إرسال رسائل/تكلفة |
| Sentry DSN | Web/API/Mobile | mixed | Sentry | عند الحاجة | تسريب traces إذا أسيء ضبطه |
| PostHog key | Web/Mobile | public key | PostHog | عند الحاجة | tracking misconfig |

## Client-Side Secret Check

- [ ] لا يوجد `JWT_SECRET` أو `DATABASE_URL` في client bundles.
- [ ] أي `NEXT_PUBLIC_*` أو `EXPO_PUBLIC_*` يعتبر عامًا.
- [ ] `AUTH_DEV_OTP=false` في production.

## Pre-Go-Live

- [ ] تدوير أسرار التطوير.
- [ ] فصل dev/staging/prod.
- [ ] إعداد backup.
- [ ] توثيق مالك كل secret.
- [ ] اختبار CORS من النطاق الإنتاجي فقط.

