---
name: دفتر
description: تطبيق محاسبة عربي للجوال للأسر المنتجة والمشاريع الصغيرة السعودية
colors:
  brand-deep: "#0f7353"
  brand-mid: "#1cb27c"
  brand-light: "#b0f1d2"
  brand-wash: "#eefdf6"
  surface-app: "#f7f8f7"
  surface-card: "#ffffff"
  ink-primary: "#101914"
  ink-secondary: "#6b7280"
  ink-tertiary: "#9ca3af"
  border-subtle: "#f3f4f6"
  border-medium: "#e5e7eb"
  semantic-danger: "#dc2626"
  semantic-danger-wash: "#fef2f2"
  semantic-warning: "#b45309"
  semantic-warning-wash: "#fffbeb"
  semantic-success: "#15803d"
  semantic-success-wash: "#dcfce7"
typography:
  display:
    fontFamily: "Tajawal, Tahoma, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Tajawal, Tahoma, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "normal"
  headline:
    fontFamily: "Tajawal, Tahoma, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "normal"
  body:
    fontFamily: "Tajawal, Tahoma, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Tajawal, Tahoma, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  full: "9999px"
  "2xl": "16px"
  xl: "12px"
  lg: "8px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-deep}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.2xl}"
    padding: "14px 20px"
  button-primary-active:
    backgroundColor: "#105c44"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.2xl}"
    padding: "14px 20px"
  button-fab:
    backgroundColor: "{colors.brand-deep}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.full}"
    size: "40px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.md}"
  input-default:
    backgroundColor: "#f9fafb"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.2xl}"
    padding: "14px 16px"
  input-focus:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.2xl}"
    padding: "14px 16px"
  badge-paid:
    backgroundColor: "{colors.semantic-success-wash}"
    textColor: "{colors.semantic-success}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-unpaid:
    backgroundColor: "{colors.semantic-danger-wash}"
    textColor: "{colors.semantic-danger}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  stat-card-brand:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.md}"
---

# Design System: دفتر

## 1. Overview

**Creative North Star: "دفتر الحساب الذكي"**

دفتر يقلّد تجربة الدفتر الورقي — المألوف والموثوق اللي كل صاحب محل يعرفه — لكنه أذكى وأسرع. الواجهة هادئة ونظيفة كصفحة بيضاء: كل شيء في مكانه، لا ضجيج، لا زخرفة. الإضاءة الخضراء الخاصة بالمشروع تبقى صادقة — لون السعي والإنتاج في السوق السعودي — لا تقتحم ولا تغيب.

الكثافة البصرية منخفضة عمدًا. المستخدم يفتح التطبيق أثناء العمل: يبيع، يسجّل، يشيّك. كل فاتورة مضافة في 30 ثانية أو أقل. الواجهة تُساعد على ذلك بأن تُقدّم المعلومة الأهم أولًا وتُخفي ما لا يُحتاج الآن.

النظام يرفض بشكل صريح: أسلوب لوحات SaaS الأمريكية (أرقام عملاقة ورسوم بيانية في كل مكان)، مصطلحات المحاسبة الغربية (QuickBooks، Wave)، وثقل التطبيقات البنكية الرسمية. النتيجة: دفتر حساب تقرأه في لحظة، لا نظام تحتاج شرحًا لتفهمه.

**Key Characteristics:**
- هادئ وأخضر — الألوان تحمل معنى، لا زينة
- RTL عربي أصيل — التدفق من اليمين لليسار، ليس مجرد mirror
- بطاقات بيضاء على خلفية رمادية خفيفة — العمق بالحدود والظل الرفيع
- خط Tajawal — عربي واضح وحديث، وزن ثقيل للأرقام والعناوين
- الأيقونات دليل وليست ديكور — كل أيقونة تُشير لوظيفة، لا تُزيّن

## 2. Colors: لوحة السوق

لوحة تعمل بإيقاع ثنائي: أبيض وخضراء عميق. الألوان الدلالية (أحمر، عنبر، أخضر) تؤدي وظيفتها بدقة.

### Primary
- **أخضر المحل** (#0f7353 / brand-700): اللون الرئيسي لكل فعل — الأزرار، حالة التبويب النشط، الأيقونات المميزة. يظهر في أقل من 15% من أي شاشة.
- **أخضر الحركة** (#1cb27c / brand-500): ربط التركيز في حقل الإدخال (ring). قل استخدامه خارج حالات الفوكس.

### Secondary
- **أخضر باهت** (#b0f1d2 / brand-200): تظليل النص المحدد (text selection). لا يُستخدم كخلفية بطاقة.
- **أخضر الغسيل** (#eefdf6 / brand-50): خلفية رقاقات الأيقونات في StatCard وEmptyState. طبقة أولى فوق البياض.

### Neutral
- **سطح التطبيق** (#f7f8f7): الخلفية العامة للتطبيق. رمادي مائل للأخضر بالكاد — ليس كريمي ولا بارد.
- **صفحة بيضاء** (#ffffff): خلفية البطاقات والمودال.
- **حبر الدفتر** (#101914): نص العناوين والأرقام الرئيسية. أسود مائل للأخضر قليلًا.
- **حبر ثانوي** (#6b7280): التسميات والأوصاف والتواريخ.
- **حبر خافت** (#9ca3af): placeholder، عناصر غير نشطة.
- **حدود خفيفة** (#f3f4f6): حدود البطاقات في حالتها العادية.
- **حدود متوسطة** (#e5e7eb): حدود حقول الإدخال وحالات الحدود المنقطة.

### Semantic
- **خطر** (#dc2626): المصاريف، الفواتير غير المدفوعة، رسائل الخطأ.
- **خطر ناعم** (#fef2f2): خلفية رسائل الخطأ وبطاقات التحذير الحمراء.
- **تحذير** (#b45309): المخزون المنخفض والتنبيهات العنبرية.
- **تحذير ناعم** (#fffbeb): خلفية بطاقة المخزون المنخفض.
- **نجاح** (#15803d): شارة "مدفوعة".
- **نجاح ناعم** (#dcfce7): خلفية شارة "مدفوعة".

### Named Rules
**قاعدة اللون بمعنى.** كل لون له وظيفة واحدة. الأخضر العميق = فعل. الأحمر = مصروف أو خطأ. العنبر = تحذير. الأخضر الفاتح = نجاح/مدفوع. لا يُستخدم لون دلالي للزينة خارج وظيفته المحددة.

**قاعدة البياض الأساسي.** البطاقات دائمًا بيضاء. الخلفية دائمًا #f7f8f7. لا تُقلب الأدوار، ولا تُضاف ألوان براند كخلفية للبطاقات العادية.

## 3. Typography

**الخط الوحيد:** Tajawal (عربي + لاتيني · Google Fonts)
**Fallback:** Tahoma, Arial, sans-serif

**الطابع:** خط هندسي عربي حديث بأوزان قوية. يُستخدم عائلة واحدة بفارق واضح في الوزن — 800 للعناوين والأرقام، 400-500 للمتن، 600-700 للتسميات والشارات.

### Hierarchy
- **Display** (وزن 800، 1.5rem / 24px، سطر 1.3): شاشة تسجيل الدخول فقط. لا يتجاوز الـ 32px في أي سياق.
- **Title** (وزن 800، 1.25rem / 20px، سطر 1.4): عنوان كل صفحة رئيسية (الرئيسية، الفواتير، المخزون...).
- **Headline** (وزن 700، 1rem / 16px، سطر 1.5): عناوين الأقسام داخل الصفحة وحقول StatCard الكبيرة.
- **Body** (وزن 400-500، 0.875rem / 14px، سطر 1.6): الأوصاف، رسائل المساعدة، محتوى القوائم.
- **Label** (وزن 600، 0.75rem / 12px، سطر 1.5): الشارات، التسميات الصغيرة، القيم داخل الشارات.

### Named Rules
**قاعدة الوزن يحمل الأولوية.** الرقم الأهم (الربح، إجمالي الفاتورة) يأخذ وزن 700-800. اسم العميل أو المنتج يأخذ 600. الوصف والتاريخ يأخذ 400-500. الهرمية من الوزن لا من الحجم فقط.

**قاعدة بلا استعلاء في الخط.** لا uppercase، لا letter-spacing واسع، لا كاريكتر خطي منفصل. الخط يتحدث بصوت السوق لا بصوت الأكاديمية.

## 4. Elevation

النظام شبه مسطّح. العمق يُعبّر عنه بثلاثة أدوات: لون الخلفية (البطاقة بيضاء على سطح رمادي)، الحدود الخفيفة، وظل رفيع (shadow-sm). لا ظلال عميقة ولا glass effects.

### Shadow Vocabulary
- **ظل البطاقة** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): الشعبية على البطاقات البيضاء فوق #f7f8f7. ثقيل جدًا إذا زاد عن ذلك في هذا التصميم.
- **ظل FAB** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): نفس الظل على زر الإضافة العائم (FAB).

### Named Rules
**قاعدة الظل الرفيع فقط.** shadow-sm في كل مكان، لا shadow-md أو shadow-lg. إذا كنت مضطرًا لظل أثقل، المشكلة في بنية الطبقات لا في الظل.

## 5. Components

### Buttons
شكلها حازم ومريح — مستديرة (rounded-2xl)، بدون حدود، بدون تدرّج.

- **الشكل:** مستدير تمامًا (16px / rounded-2xl) للأزرار الأساسية الكاملة. rounded-xl (12px) للأزرار الصغيرة داخل المحتوى.
- **أساسي:** خلفية #0f7353، نص أبيض، py-3.5 px-5. `transition` على الألوان. حالة `:active`: خلفية #105c44 (تعمّق الأخضر).
- **تعطيل:** opacity-60، نفس الشكل، لا تغيير في الشكل.
- **FAB (زر الإضافة العائم):** 40×40px، دائري (rounded-full)، نفس اللون الأساسي، shadow-sm.
- **لا توجد أزرار Outline أو Ghost بشكل رسمي** في النظام الحالي — التمييز الثاني يتم بلون مختلف أو رابط نصي.

### Cards / Containers
مساحات بيضاء على خلفية #f7f8f7.

- **الزاوية:** rounded-2xl (16px) — لا استثناء للبطاقات.
- **الخلفية:** #ffffff دائمًا.
- **الحدود:** border border-gray-100 (#f3f4f6). خفيفة جدًا — لإضافة التعريف لا الثقل.
- **الظل:** shadow-sm. بطاقة بلا ظل ولا حدود تذوب في الخلفية.
- **الحشو الداخلي:** p-4 (16px) كمعيار. p-3.5 (14px) للقوائم المضغوطة.
- **لا بطاقات متداخلة:** إذا كان عنصر داخل بطاقة يحتاج حاوية، استخدم `bg-gray-50 rounded-xl` بلا shadow ولا حدود.

### Inputs / Fields
حقل بسيط ومرن — خلفية رمادية فاتحة تتحوّل لبيضاء عند التفاعل.

- **الشكل:** rounded-2xl (16px)، نفس نصاعة البطاقات.
- **الحالة العادية:** خلفية #f9fafb، حدود #e5e7eb (1px).
- **حالة الفوكس:** خلفية #ffffff، حدود #1cb27c، ring-2 ring-brand-600 (أخضر، عرض 2px).
- **الخطأ:** حدود #dc2626، ring-2 ring-red-500.
- **أيقونة على اليمين (في الحقول العربية):** padding-right كافٍ لإفساح مجال الأيقونة (pr-11 مع أيقونة 5w).
- **لا placeholder رمادي خافت:** placeholder يكون بلون #9ca3af (gray-400) كحد أدنى — لا أقل لضمان 4.5:1.

### Navigation
شريط سفلي ثابت يحمل 5 تبويبات.

- **الخلفية:** أبيض شبه شفاف (bg-white/95 مع backdrop-blur).
- **الحدود:** border-t border-gray-200 للفصل اللطيف عن المحتوى.
- **التبويب النشط:** أيقونة + نص بلون brand-700 (#0f7353)، strokeWidth=2.5.
- **التبويب غير النشط:** رمادي (#6b7280)، strokeWidth=2.
- **حجم الأيقونة:** 24×24px (h-6 w-6).
- **النص:** 11px، وزن 500.
- **لا مؤشر خط أسفل التبويب النشط** — اللون وحده يكفي.

### Badges (Status)
شارات دائرية (pill) لحالة الفاتورة.

- **مدفوعة:** خلفية #dcfce7، نص #15803d.
- **غير مدفوعة:** خلفية #fef2f2، نص #dc2626.
- **جزئي:** خلفية #fefce8، نص #854d0e.
- **الشكل:** rounded-full، px-2.5 py-1، وزن 600، 12px.
- **لا badges ملوّنة خارج الثلاثة الدلالية** — لا أزرق أو بنفسجي للحالات.

### StatCard (بطاقة الإحصائية)
بطاقة بيضاء بأيقونة ملوّنة في الزاوية.

- **الشكل:** rounded-2xl، border border-gray-100، shadow-sm.
- **الأيقونة:** داخل رقاقة دائرية ملوّنة — brand-wash لحالة brand، red-50 لحالة red.
- **القيمة:** نص كبير وزن 700، tracking-tight.
- **التسمية:** text-sm وزن 500، gray-500.

### EmptyState
يظهر عندما لا توجد بيانات — دائمًا تشجيعي لا محبط.

- **الحدود:** border border-dashed border-gray-200 — منقطة للإشارة إلى الفراغ القابل للملء.
- **الأيقونة:** داخل دائرة brand-wash.
- **النص الرئيسي:** وزن 600، gray-800.
- **النص الفرعي:** وزن 400، gray-500.
- **زر الإجراء (اختياري):** button-primary بحجم أصغر (px-5 py-2.5).

### BottomSheet (الصفحة التحتية)
حوار RTL يعالج WCAG 4.1.2 بشكل كامل (role=dialog، aria-modal، focus trap).

- **الخلفية:** أبيض، rounded-t-3xl.
- **التراكب:** أسود شبه شفاف (backdrop).
- **يُفتح من أسفل الشاشة** — الإيماء الطبيعي للجوال.

## 6. Do's and Don'ts

### Do:
- **افعل** استخدم brand-700 (#0f7353) حصريًا للأفعال والحالات النشطة — لا تُخفّفه على الكارد العادي.
- **افعل** أضف `prefers-reduced-motion` لكل transition أو animation — WCAG 2.3.3.
- **افعل** استخدم WCAG AA كحد أدنى: 4.5:1 للنص العادي (14px+)، 3:1 للنص الكبير (18px+).
- **افعل** اختبر كل تسمية بـ `text-sm text-gray-500` مقابل خلفيتها — gray-500 على أبيض = 3.95:1 فقط (فاشل). استخدم gray-600 (#4b5563) إذا كان الحجم أقل من 18px.
- **افعل** حافظ على `max-w-md` (448px) كحد أقصى للمحتوى — التطبيق للجوال أولًا.
- **افعل** حافظ على `pb-24` أسفل المحتوى لأن BottomNav يغطي ~80px + safe-area.
- **افعل** استخدم لغة السوق السعودية اليومية — "الزباين"، "لي عند"، "المخزون" — لا مصطلحات المحاسبة.
- **افعل** استخدم rounded-2xl (16px) على جميع البطاقات والحقول بلا استثناء.

### Don't:
- **لا** تُقلّد تصميمات QuickBooks أو Wave أو Xero — مصطلحاتها الإنجليزية المعرّبة ووجهاتها المعقدة تُحسّس المستخدم بالغربة.
- **لا** تستخدم لوحة SaaS Dashboard الكلاسيكية — أرقام عملاقة gradient، رسوم بيانية في كل شاشة، metrics مع أيقونات ملوّنة في مربعات — هذا ليس دفتر الحساب.
- **لا** تُضيف تدرّجات لونية (gradients) — لا على النص، ولا على خلفيات الأزرار، ولا على الأيقونات.
- **لا** تستخدم `border-left` أو `border-right` بسماكة أكبر من 1px كشريط زخرفي ملوّن.
- **لا** تُداخل بطاقات (card inside card) — إذا احتجت تقسيمًا داخل البطاقة، استخدم فصلًا بلون خلفية مختلف (bg-gray-50) بدون حدود أو ظل.
- **لا** تُضيف eyebrow (كلمة صغيرة uppercase فوق كل عنوان) — لا يوجد eyebrow في دفتر.
- **لا** تستخدم ألوانًا دلالية (أحمر، عنبر، أخضر باهت) خارج وظيفتها الدلالية — لا أحمر للزينة، لا أخضر فاتح كخلفية بطاقة عادية.
- **لا** تُضيف ظلالًا أثقل من shadow-sm — المشروع يعتمد على الحدود الخفيفة وفرق لون الخلفية، ليس العمق البصري الثقيل.
- **لا** تستخدم Glassmorphism أو backdrop-blur كزخرفة — blur مسموح فقط على BottomNav وTopBar كحاجة وظيفية.
