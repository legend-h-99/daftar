# دفتر — حالة المشروع

> آخر تحديث: 22 أغسطس 2026

---

## ما هو دفتر؟

**دفتر** تطبيق محاسبة عربي مبسّط للأسر المنتجة والمشاريع الصغيرة في السعودية. يُمكّن صاحب المشروع من متابعة مبيعاته ومصاريفه وفواتيره وأرباحه من مكان واحد — بدون مصطلحات محاسبية.

- **الموقع المنشور:** https://daftar-ead.pages.dev
- **API (Backend):** https://daftar-api.onrender.com
- **مستودع GitHub:** https://github.com/legend-h-99/daftar

---

## هيكل المشروع (Monorepo)

```
daftar/
├── apps/
│   ├── web/          # Next.js 14 App Router — PWA مستضاف على Cloudflare Pages
│   └── api/          # NestJS REST API — مستضاف على Render
├── package.json      # pnpm workspaces root
└── pnpm-lock.yaml
```

---

## تقنيات المشروع

### Frontend (apps/web)
| التقنية | الاستخدام |
|---|---|
| Next.js 14 (App Router) | إطار العمل — Static Export على Cloudflare Pages |
| TypeScript | لغة البرمجة |
| Tailwind CSS | التصميم والـ styling |
| Shadcn/ui | مكتبة مكونات UI |
| Lucide React | الأيقونات |
| Recharts | الرسوم البيانية في الـ dashboard |
| PWA (sw.js) | Service Worker لدعم العمل offline |

### Backend (apps/api)
| التقنية | الاستخدام |
|---|---|
| NestJS | إطار العمل |
| Prisma ORM | قاعدة البيانات |
| PostgreSQL | قاعدة البيانات (على Render) |
| JWT | المصادقة |
| Google OAuth | تسجيل الدخول بـ Google |

---

## صفحات التطبيق

### صفحات عامة (بدون تسجيل دخول)
| الصفحة | المسار | الحالة |
|---|---|---|
| الصفحة الرئيسية | `/` | ✅ تعمل — تظهر Landing Page للزوار، تُعيد التوجيه للـ dashboard للمسجلين |
| Landing Page | `/landing` | ✅ تعمل |
| تسجيل الدخول | `/login` | ✅ تعمل — Phone OTP + Google + Demo |
| إدخال OTP | `/otp` | ✅ تعمل |
| الإعداد الأولي | `/onboarding` | ✅ تعمل — خطوتان: اسم المحل + تفعيل VAT |
| Offline | `/offline` | ✅ PWA fallback |

### صفحات التطبيق (تتطلب تسجيل دخول)
| الصفحة | المسار | الوصف |
|---|---|---|
| لوحة التحكم | `/dashboard` | ملخص الأرباح والمصاريف والإيرادات |
| الفواتير | `/invoices` | قائمة الفواتير + إنشاء جديد |
| تفصيل فاتورة | `/invoices/[id]` | عرض الفاتورة، تحديث الحالة، تحميل PDF |
| إنشاء فاتورة | `/invoices/new` | نموذج إنشاء فاتورة جديدة |
| المصاريف | `/expenses` | تتبع المصاريف اليومية |
| المخزون | `/inventory` | إدارة المخزون |
| المشتريات | `/purchases` | تسجيل المشتريات وتحديث المخزون |
| مسح مشتريات | `/purchases/scan` | مسح الباركود |
| المنتجات | `/products` | إدارة قائمة المنتجات |
| تعديل منتج | `/products/[id]/edit` | تعديل تفاصيل المنتج |
| منتج جديد | `/products/new` | إضافة منتج جديد |
| التقارير | `/reports` | تقارير شهرية وسنوية |

---

## API Endpoints

### Auth
```
POST /api/auth/otp/request    → طلب رمز التحقق
POST /api/auth/otp/verify     → التحقق من الرمز والحصول على JWT
POST /api/auth/demo           → دخول تجريبي (يحتاج DEMO_AUTH_ENABLED=true)
POST /api/auth/google         → تسجيل دخول Google
GET  /api/auth/me             → بيانات المستخدم الحالي
POST /api/auth/logout         → تسجيل الخروج
```

### Business & Dashboard
```
GET/POST/PATCH /api/business
GET /api/dashboard
```

### المحتوى
```
GET/POST/PATCH/DELETE /api/invoices
GET/POST/PATCH/DELETE /api/expenses
GET/POST/PATCH/DELETE /api/products
GET/POST/PATCH/DELETE /api/purchases
GET/POST/PATCH/DELETE /api/inventory
GET/POST/PATCH/DELETE /api/customers
GET/POST/PATCH/DELETE /api/suppliers
GET/POST/PATCH/DELETE /api/materials
```

---

## ما تم إنجازه (مراحل العمل)

### المرحلة 1 — البنية الأساسية
- [x] إعداد monorepo بـ pnpm workspaces
- [x] NestJS API مع Prisma + PostgreSQL
- [x] Next.js مع Tailwind CSS و Shadcn/ui
- [x] نظام auth كامل (Phone OTP + Google + Demo)
- [x] JWT مع token blacklist عند logout
- [x] Prisma schema كامل لجميع الكيانات

### المرحلة 2 — شاشات التطبيق
- [x] Dashboard مع رسوم بيانية (Recharts)
- [x] إدارة الفواتير (إنشاء، عرض، تحديث الحالة، تحميل PDF)
- [x] تتبع المصاريف
- [x] إدارة المخزون
- [x] تسجيل المشتريات
- [x] إدارة المنتجات
- [x] تقارير شهرية/سنوية
- [x] PWA مع service worker

### المرحلة 3 — التصميم والجودة
- [x] Landing page كامل (SEO + AEO) بعربي RTL
- [x] صفحة Onboarding متعددة الخطوات (ثنائية اللغة)
- [x] تصميم موحّد (fieldClass، StatusBadge، TopBar، BottomNav)
- [x] إصلاح جدول المقارنة على الجوال (grid-cols-4 بدل table)
- [x] دعم ثنائي اللغة (عربي/إنجليزي)
- [x] مجموعة اختبارات (138 اختبار Vitest عبر 7 ملفات)

### المرحلة 4 — النشر
- [x] API على Render (https://daftar-api.onrender.com)
- [x] الموقع على Cloudflare Pages (https://daftar-ead.pages.dev)
- [x] Static Export (`NEXT_OUTPUT_EXPORT=1`) لتجنب مشاكل الـ cache
- [x] SPA redirects في `_redirects` للمسارات الديناميكية
- [x] env vars على Cloudflare Pages (API URL + Demo Login)
- [x] الـ `build` command معزول لـ web فقط (`pnpm --filter web build`)

---

## ما يحتاج إكمالاً

### 🔴 مهم — تسجيل الدخول

#### 1. Demo Login (سريع — دقيقتان)
أضف على Render:
```
DEMO_AUTH_ENABLED=true
```
بعدها زر "دخول تجريبي" في صفحة Login سيُنشئ حسابات حقيقية في DB.

#### 2. Google Sign-In
**خطوات الإعداد:**
1. افتح [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. **Create Credentials → OAuth 2.0 Client ID → Web application**
3. Authorized JavaScript origins:
   ```
   https://daftar-ead.pages.dev
   http://localhost:3000
   ```
4. احصل على **Client ID** (مثال: `123456.apps.googleusercontent.com`)

**بعد الحصول على Client ID:**

على Cloudflare Pages:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID = <client_id>
```

على Render:
```
GOOGLE_CLIENT_ID = <client_id>
```

#### 3. SMS OTP حقيقي (للإنتاج الكامل)
الكود جاهز في `apps/api/src/auth/auth.service.ts` — ينتظر ربط SMS gateway.

الخيارات الموصى بها للسوق السعودي:
- **[Unifonic](https://unifonic.com)** — مزود سعودي، واجهة عربية
- **[Taqnyat](https://taqnyat.sa)** — مزود سعودي، OTP مخصص

---

### 🟡 تحسينات مستقبلية
- [ ] Domain مخصص (بدلاً من `daftar-ead.pages.dev`)
- [ ] تفعيل NEXT_PUBLIC_GOOGLE_CLIENT_ID على Cloudflare Pages
- [ ] ربط SMS gateway لـ OTP حقيقي
- [ ] إشعارات WhatsApp للفواتير
- [ ] تطبيق جوال (React Native — موجود في `apps/mobile`)
- [ ] نظام اشتراكات/دفع

---

## متغيرات البيئة

### Cloudflare Pages (Frontend)
| المتغير | القيمة | الحالة |
|---|---|---|
| `NEXT_OUTPUT_EXPORT` | `1` | ✅ مضبوط |
| `NEXT_PUBLIC_API_URL` | `https://daftar-api.onrender.com/api` | ✅ مضبوط |
| `NEXT_PUBLIC_DEMO_LOGIN` | `true` | ✅ مضبوط |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `<client_id>` | ⏳ ينتظر إعداد Google OAuth |

### Render (Backend API)
| المتغير | الوصف | الحالة |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ مضبوط |
| `JWT_SECRET` | مفتاح توقيع الـ JWT | ✅ مضبوط |
| `NODE_ENV` | `production` | ✅ مضبوط |
| `DEMO_AUTH_ENABLED` | تفعيل Demo Login | ⏳ أضفه = `true` |
| `GOOGLE_CLIENT_ID` | Google OAuth | ⏳ ينتظر Client ID |

---

## بنية المصادقة

```
المستخدم → رقم جوال → [SMS OTP*] → JWT (30 يوم) → localStorage
المستخدم → Google   → OAuth      → JWT (30 يوم) → localStorage
المستخدم → Demo     → DB lookup  → JWT (30 يوم) → localStorage

* SMS gateway لم يُربط بعد — يحتاج Unifonic أو Taqnyat
```

---

## الاختبارات

```
apps/web/__tests__/
├── login.test.tsx      (19 اختبار)
├── onboarding.test.tsx (20 اختبار)
├── otp.test.tsx        (25 اختبار)
├── invoices.test.tsx   (22 اختبار)
├── expenses.test.tsx   (24 اختبار)
├── landing.test.tsx    (48 اختبار)
└── dashboard.test.tsx  (~ 15 اختبار)
```

---

## كيف تشغّل المشروع محلياً

```bash
# تثبيت الاعتمادات
pnpm install

# تشغيل الـ API (يحتاج .env في apps/api)
pnpm dev:api

# تشغيل الموقع (على http://localhost:3000)
pnpm dev:web

# بناء الموقع فقط (للـ deploy)
pnpm build
```

---

## سجل النشر

| التاريخ | الحدث |
|---|---|
| 22 أغسطس 2026 | نشر Cloudflare Pages أول deploy ناجح |
| 22 أغسطس 2026 | إصلاح مشكلة cache size (36 MB) بالانتقال لـ static export |
| 22 أغسطس 2026 | إضافة `_redirects` للمسارات الديناميكية |
| 22 أغسطس 2026 | تفعيل `NEXT_PUBLIC_DEMO_LOGIN=true` على Cloudflare Pages |
| سابق | API على Render جاهز ومنشور |
| سابق | إعادة كتابة Landing Page (SEO+AEO كامل) |
| سابق | إصلاح جدول المقارنة على الجوال |
| سابق | إضافة 138 اختبار (Vitest) |
