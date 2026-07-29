# 08 Execution — دفتر

## PRD

### 1. Summary

دفتر MVP يساعد الأسر المنتجة على إنشاء فواتير عربية، تسجيل المصاريف، حساب تكلفة المنتجات، متابعة "لي عند"، ورؤية الربح الشهري. الإطلاق الأول يستهدف بائعات الطعام المنزلي في السعودية.

### 2. Contacts

| Name | Role | Comment |
|---|---|---|
| حسام | Founder / PM / Dev | القرار والتنفيذ |
| أم الطيبين | Beachhead persona | تمثل مستخدمة MVP |
| بنك التنمية | Partner potential | قناة B2B2C محتملة |

### 3. Background

الفئة الحالية تبيع عبر واتساب وتدير الحسابات بالورقة أو Excel. المشكلة ليست نقص برنامج محاسبة شامل، بل غياب إجابة بسيطة: كم ربحت بعد التكاليف؟ ومن لم يدفع؟

### 4. Objective

تحقيق Problem-Solution Fit مع شريحة الطعام المنزلي عبر قيمة واضحة في أول يوم استخدام.

### Key Results

| KR | Baseline | Target | Timeframe |
|---|---:|---:|---|
| Activation | 0% | ≥ 60% | Q3 2026 |
| D7 retention | 0% | ≥ 40% | Q3 2026 |
| WAU | 0 | 50 | Q3 2026 |
| NPS | n/a | ≥ 50 | بعد شهر |

### 5. Market Segment(s)

Beachhead: بائعات الطعام المنزلي في الرياض وجدة، 15-30 طلب/أسبوع، واتساب أولًا، لا خبرة محاسبية.

### 6. Value Proposition(s)

دفتر يحسب ربحك تلقائيًا ويذكرك بمن لم يدفع، بلغة السوق ومن الجوال، خلافًا لبرامج المحاسبة المصممة للمحاسبين.

### 7. Solution

#### Key Features P0

- OTP وتسجيل نشاط.
- فواتير PDF عربية ومشاركة واتساب.
- حالات الفاتورة: غير مدفوعة، جزئية، مدفوعة، متأخرة منطقيًا.
- تسجيل مصاريف وتصنيفات.
- منتجات ووصفات ومواد خام وحساب تكلفة.
- لوحة تحكم: مبيعات، ربح، مديونون، أكثر منتج.
- مخزون مواد خام وحركات.

#### Technology

Next.js web، Expo mobile، NestJS API، Prisma/PostgreSQL، JWT، pdfkit، PWA.

#### Assumptions

- MVP مجاني حتى PMF.
- لا ZATCA كامل الآن.
- OTP الحقيقي مطلوب قبل الإنتاج.
- OCR في الكود كمزود mock/مبدئي وليس جوهر P0.

### 8. Release

| Version | Scope | Out Of Scope | Release Criteria |
|---|---|---|---|
| P1 Soft Launch | web + Android + OTP + invoices + profit | iOS، ZATCA كامل، paywall | مستخدمة حقيقية تنشئ فاتورة وترى الربح |
| P2 | onboarding، push، paid plans، OCR أفضل | ERP | D7/D30 مقبول |
| P3 | Gulf localization، integrations | بناء مدفوعات مرخصة ذاتيًا | PMF مثبت |

## Outcome Roadmap

| Phase | Outcome Statement | Metric | Possible Outputs | Dependencies |
|---|---|---|---|---|
| P1 | تمكين الأسرة من رؤية الربح من أول فاتورة | Activation | OTP، فاتورة، dashboard | إنتاج API/web |
| P1.5 | تقليل نسيان الديون | reminders sent | قائمة لي عند | invoice states |
| P2 | رفع الاحتفاظ الشهري | D30 | تقرير شهري، push | analytics |
| P2 | اختبار الدفع | paid CVR | paywall/fake-door | pricing experiment |

## User Stories

| Title | Story | Acceptance Criteria | Size | Dependency |
|---|---|---|---|---|
| OTP login | كمستخدمة أريد الدخول برقم الجوال | رمز حقيقي، TTL، rate limit | M | OTP provider |
| Create invoice | أريد فاتورة في 3 نقرات | عميل، بنود، إجمالي، PDF | L | products/customers |
| Track debt | أريد معرفة من لم يدفع | قائمة مرتبة بالأقدم والمبلغ | M | invoices |
| Product recipe | أريد حساب تكلفة المنتج | مواد + كميات + تكلفة مجمدة | L | materials |
| Profit dashboard | أريد صافي الربح | دخل - مصاريف - تكلفة | L | invoices/expenses |

## Prioritization

| Opportunity / Story | Reach | Impact | Confidence | Effort | RICE |
|---|---:|---:|---:|---:|---:|
| OTP production | 100 | 3 | 100% | 2 | 150 |
| First invoice flow | 100 | 3 | 90% | 3 | 90 |
| Profit dashboard | 100 | 3 | 80% | 4 | 60 |
| Recipe onboarding | 70 | 3 | 70% | 4 | 36.75 |
| Referral link | 50 | 2 | 60% | 2 | 30 |

## Sprint Plan

- Sprint goal: جعل المسار الحرج يعمل على بيئة إنتاج.
- Duration: أسبوعان.
- Team capacity: مؤسس فردي، 60-70% تركيز منتج/كود.
- Buffer: 20%.

| Story | Points | Owner | Dependency | Risk |
|---|---:|---|---|---|
| OTP channel | 5 | حسام | WhatsApp/SMS | مزود خارجي |
| Production DB/API | 3 | حسام | env/secrets | migration |
| Web deploy | 3 | حسام | API URL | CORS |
| Analytics events | 2 | حسام | PostHog | privacy |
| E2E smoke | 3 | حسام | full stack | device bugs |

## Pre-Mortem

| Risk | Type | Urgency | Mitigation | Owner |
|---|---|---|---|---|
| OTP لا يصل | Tiger | Launch-blocking | مزود حقيقي + fallback | حسام |
| المستخدمة لا تكمل الوصفة | Tiger | Fast-follow | فاتورة أولًا + أمثلة | حسام |
| تقرير الربح غير موثوق | Tiger | Launch-blocking | شرح مصدر الرقم واختبارات | حسام |
| ZATCA confusion | Elephant | Track | نصوص واضحة "غير معتمد" | حسام |
| السعر يقتل التحويل | Paper/Tiger | Track | Freemium + fake-door | حسام |

## Test Scenarios

| Scenario | Objective | Starting Conditions | Steps | Expected Outcome |
|---|---|---|---|---|
| تسجيل OTP | تحقق دخول حقيقي | رقم صالح | طلب رمز، تحقق | JWT + user |
| إنشاء فاتورة | تحقق activation | نشاط ومنتج | أنشئ فاتورة وشارك PDF | فاتورة محفوظة |
| دفعة جزئية | تحقق "لي عند" | فاتورة غير مدفوعة | سجل دفعة | paidAmount/status صحيح |
| وصفة تكلفة | تحقق الحساب | مادة ومنتج | أضف recipe item | totalCost/margin صحيح |
| عزل الأعمال | تحقق الصلاحيات | مستخدمان | محاولة قراءة بيانات الآخر | رفض/عدم إظهار |

## Release Notes Draft

### New Features

- فواتير عربية قابلة للمشاركة.
- لوحة ربح شهرية مبسطة.
- متابعة "لي عند".
- منتجات ووصفات لحساب التكلفة.

### Improvements

- تجربة عربية RTL وجوال أولًا.

### Known Limits

- لا يوجد اعتماد ZATCA.
- OTP الإنتاج يحتاج تفعيل مزود.
- المدفوعات ليست مفعلة في MVP.

