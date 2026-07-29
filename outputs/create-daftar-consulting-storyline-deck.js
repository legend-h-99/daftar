const path = require("path");
const PptxGenJS = require("pptxgenjs");

const outDir = __dirname;
const pptxPath = path.join(outDir, "daftar-consulting-storyline.pptx");

const pptx = new PptxGenJS();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Daftar";
pptx.company = "Daftar";
pptx.subject = "Daftar consulting-style storyline";
pptx.title = "دفتر — عرض استشاري بأسلوب McKinsey / BCG / Bain";
pptx.lang = "ar-SA";
pptx.rtlMode = true;
pptx.theme = {
  headFontFace: "Tajawal",
  bodyFontFace: "Tajawal",
  lang: "ar-SA",
};

const C = {
  brand: "0F7353",
  brand50: "EEFDF6",
  ink: "101914",
  muted: "6B7280",
  tertiary: "9CA3AF",
  surface: "F7F8F7",
  card: "FFFFFF",
  border: "E5E7EB",
  softBorder: "F3F4F6",
  danger: "DC2626",
  dangerWash: "FEF2F2",
  warning: "B45309",
  warningWash: "FFFBEB",
  success: "15803D",
};

const W = 13.333;
const H = 7.5;
const M = 0.72;

function addBg(slide) {
  slide.background = { color: C.surface };
  slide.addText("د", {
    x: M,
    y: 0.38,
    w: 0.46,
    h: 0.46,
    margin: 0,
    align: "center",
    valign: "mid",
    fontFace: "Tajawal",
    fontSize: 15,
    bold: true,
    color: "FFFFFF",
    fill: { color: C.brand },
    radius: 0.13,
    breakLine: false,
  });
}

function footer(slide, idx, label = "دفتر · SCR/SCQA · Dot-dash · Slide skeleton") {
  slide.addShape(pptx.ShapeType.line, {
    x: M,
    y: H - 0.55,
    w: W - M * 2,
    h: 0,
    line: { color: C.border, width: 1 },
  });
  slide.addText(String(idx).padStart(2, "0"), {
    x: M,
    y: H - 0.43,
    w: 0.4,
    h: 0.22,
    fontFace: "Tajawal",
    fontSize: 7.5,
    color: C.tertiary,
    margin: 0,
  });
  slide.addText(label, {
    x: W - M - 7,
    y: H - 0.42,
    w: 7,
    h: 0.22,
    fontFace: "Tajawal",
    fontSize: 7.5,
    color: C.tertiary,
    margin: 0,
    align: "right",
  });
}

function headline(slide, text, sub) {
  slide.addText(text, {
    x: W - M - 11.2,
    y: 0.82,
    w: 11.2,
    h: 0.75,
    fontFace: "Tajawal",
    fontSize: 25,
    bold: true,
    color: C.ink,
    align: "right",
    fit: "shrink",
    margin: 0,
  });
  if (sub) {
    slide.addText(sub, {
      x: W - M - 10.8,
      y: 1.58,
      w: 10.8,
      h: 0.45,
      fontFace: "Tajawal",
      fontSize: 11.5,
      color: C.muted,
      align: "right",
      fit: "shrink",
      margin: 0,
    });
  }
}

function pill(slide, text, x, y, w = 1.8, color = C.brand, fill = C.brand50) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.34,
    fontFace: "Tajawal",
    fontSize: 8.7,
    bold: true,
    color,
    fill: { color: fill },
    margin: 0.06,
    align: "center",
    valign: "mid",
    fit: "shrink",
    radius: 0.15,
  });
}

function card(slide, x, y, w, h, heading, body, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: C.card },
    line: { color: opts.line || C.softBorder, width: 1 },
  });
  if (opts.num) {
    slide.addText(opts.num, {
      x: x + w - 0.72,
      y: y + 0.28,
      w: 0.42,
      h: 0.42,
      fontFace: "Tajawal",
      fontSize: 12,
      bold: true,
      color: opts.numColor || C.brand,
      align: "center",
      valign: "mid",
      fill: { color: opts.numFill || C.brand50 },
      radius: 0.12,
      margin: 0,
    });
  }
  slide.addText(heading, {
    x: x + 0.34,
    y: y + 0.32,
    w: w - 0.72,
    h: 0.34,
    fontFace: "Tajawal",
    fontSize: 12.5,
    bold: true,
    color: opts.headingColor || C.ink,
    align: "right",
    margin: 0,
    fit: "shrink",
  });
  slide.addText(body, {
    x: x + 0.34,
    y: y + 0.82,
    w: w - 0.68,
    h: h - 1.05,
    fontFace: "Tajawal",
    fontSize: 10.2,
    color: C.muted,
    align: "right",
    breakLine: false,
    fit: "shrink",
    margin: 0,
    valign: "top",
  });
}

function dotDash(slide, x, y, rows, width = 10.6) {
  rows.forEach((r, i) => {
    const yy = y + i * 0.66;
    slide.addText("•", { x: x + width - 0.2, y: yy, w: 0.2, h: 0.3, fontSize: 16, color: C.brand, margin: 0, align: "right" });
    slide.addText(r.dot, {
      x: x + width - 3.35,
      y: yy + 0.02,
      w: 2.85,
      h: 0.3,
      fontFace: "Tajawal",
      fontSize: 11.6,
      bold: true,
      color: C.ink,
      margin: 0,
      align: "right",
      fit: "shrink",
    });
    slide.addText("– " + r.dash, {
      x,
      y: yy + 0.04,
      w: width - 3.6,
      h: 0.35,
      fontFace: "Tajawal",
      fontSize: 10.1,
      color: C.muted,
      margin: 0,
      align: "right",
      fit: "shrink",
    });
  });
}

function arrow(slide, x1, y1, x2, y2) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color: C.brand, width: 1.2, beginArrowType: "triangle", endArrowType: "none" },
  });
}

{
  const s = pptx.addSlide();
  addBg(s);
  pill(s, "قصة استشارية عن دفتر", W - M - 2.15, 0.86, 2.15);
  s.addText("دفتر يجب أن يبدأ من الأسر المنتجة لا من المحاسبة التقليدية", {
    x: W - M - 8.7,
    y: 1.55,
    w: 8.7,
    h: 1.45,
    fontFace: "Tajawal",
    fontSize: 28,
    bold: true,
    color: C.ink,
    align: "right",
    margin: 0,
    fit: "shrink",
  });
  s.addText("عرض منفصل بأسلوب McKinsey / BCG / Bain: SCQA، dot-dash، عناوين فعلية، وتدفق شرائح واضح.", {
    x: W - M - 7.2,
    y: 3.08,
    w: 7.2,
    h: 0.5,
    fontFace: "Tajawal",
    fontSize: 12,
    color: C.muted,
    align: "right",
    margin: 0,
  });
  card(s, M, 1.55, 3.85, 3.35, "الخلاصة التنفيذية", "إذا كان وعد دفتر هو معرفة الربح في 10 ثوان، فالأولوية ليست بناء نظام محاسبي شامل؛ الأولوية هي امتلاك لحظة يومية واحدة: فاتورة، مصروف، وربح واضح.", { line: C.brand });
  footer(s, 1, "عرض قرار · دفتر");
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "الرسالة الرئيسية: دفتر يفوز عندما يختصر المحاسبة إلى قرار يومي بسيط", "هذه هي القصة التي سيحملها العرض من أول شريحة إلى آخر شريحة.");
  card(s, 9.05, 2.15, 3.15, 2.2, "الفئة", "أسر منتجة ومشاريع صغيرة تبيع عبر واتساب، بلا خبرة محاسبية وبوقت ضيق.", { num: "1" });
  card(s, 5.05, 2.15, 3.15, 2.2, "الألم", "لا تعرف الربح الحقيقي، من لم يدفع، ولا تكلفة المنتج بدقة.", { num: "2", line: C.warning });
  card(s, 1.05, 2.15, 3.15, 2.2, "الحل", "دفتر حساب عربي جوال أولًا: فواتير، مصاريف، مخزون، وربح شهري واضح.", { num: "3", line: C.brand });
  arrow(s, 8.82, 3.25, 8.38, 3.25);
  arrow(s, 4.82, 3.25, 4.38, 3.25);
  footer(s, 2);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "SCQA يجعل فرصة دفتر سؤالًا استثماريًا وتشغيليًا واحدًا", "القصة لا تبدأ بالميزات؛ تبدأ بتغير في السوق يخلق قرارًا.");
  card(s, 9.45, 2.0, 2.6, 2.1, "Situation", "البيع المنزلي والعمل الحر أصبحا قنوات دخل واسعة ومشروعة في السعودية.", { num: "S" });
  card(s, 6.35, 2.0, 2.6, 2.1, "Complication", "الأدوات الموجودة صُممت للشركات، بينما الفئة تدير العمل عبر واتساب ودفتر ورقي.", { num: "C", line: C.warning });
  card(s, 3.25, 2.0, 2.6, 2.1, "Question", "كيف نساعدها تعرف ربحها بدون أن نجعلها تتعلم محاسبة؟", { num: "Q" });
  card(s, 0.15, 2.0, 2.6, 2.1, "Answer", "نبني دفتر حول لحظة الربح: سجل البيع، اخصم التكلفة، اعرف المتبقي.", { num: "A", line: C.brand });
  dotDash(s, 1.0, 5.0, [
    { dot: "الموقف", dash: "السوق كبير، لكن أدواته اليومية بدائية." },
    { dot: "التعقيد", dash: "البديل المهني ثقيل، والبديل البسيط لا يعطي قرارًا." },
    { dot: "السؤال", dash: "ما أقل تجربة تجعل المستخدمة تثق برقم الربح؟" },
    { dot: "الإجابة", dash: "منتج عربي بسيط يربط الفاتورة بالمصروف والتكلفة." },
  ], 11.1);
  footer(s, 3);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "SCR يحول دفتر من تطبيق ميزات إلى رحلة تغيير للمستخدمة", "الوعد ليس “إدارة مالية”، بل الانتقال من التخمين إلى معرفة الربح.");
  card(s, 8.75, 2.15, 3.4, 2.25, "Situation", "المستخدمة تبيع، تستلم تحويلات، وتسجل بعض الأشياء في الورق أو الذاكرة.", { num: "S" });
  card(s, 4.93, 2.15, 3.4, 2.25, "Complication", "آخر الشهر لا تعرف هل المنتج يربح، ومن دفع، وكم بقي لها عند الزباين.", { num: "C", line: C.warning });
  card(s, 1.1, 2.15, 3.4, 2.25, "Resolution", "دفتر يجعل كل بيع يضيف رقمًا واضحًا إلى الربح والمديونية والمخزون.", { num: "R", line: C.brand });
  arrow(s, 8.55, 3.25, 8.1, 3.25);
  arrow(s, 4.72, 3.25, 4.28, 3.25);
  card(s, 1.1, 5.0, 11.05, 0.85, "جملة القصة", "من “أبيع كثيرًا ولا أعرف ربحي” إلى “أفتح دفتر وأعرف ربحي هذا الشهر في 10 ثوان”.", { line: C.brand });
  footer(s, 4);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "Dot-dash storyline يثبت أن الأولوية هي لحظة الربح لا كثرة الميزات", "اكتب المنطق أولًا، ثم حوّله إلى شرائح.");
  dotDash(s, 1.05, 2.15, [
    { dot: "التوصية", dash: "ركّز MVP على بائعات الطعام المنزلي في الرياض وجدة." },
    { dot: "سبب التركيز", dash: "لديهن تكرار طلبات عالٍ، تكلفة مكونات واضحة، وألم ربح مباشر." },
    { dot: "المشكلة الحرجة", dash: "الربح يضيع بين السعر، الخامات، التوصيل، والمديونية." },
    { dot: "التجربة الفائزة", dash: "فاتورة سريعة + مصروف سريع + تقرير ربح شهري في شاشة واحدة." },
    { dot: "التحقق", dash: "نقيس تفعيل أول فاتورة خلال 24 ساعة، D7 retention، ومعرفة الربح." },
  ], 11.2);
  card(s, 1.05, 5.95, 11.2, 0.55, "اختبار الجودة", "كل نقطة يمكن أن تصبح عنوان شريحة. وكل شرطة تحتها هي الدليل أو التصميم الذي يثبتها.", { line: C.brand });
  footer(s, 5);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "العنوان الفعلي يجعل كل شريحة في عرض دفتر تحمل استنتاجًا", "لا تكتب موضوع الشريحة؛ اكتب ما تريد من القارئ أن يصدقه.");
  card(s, 6.85, 2.2, 5.35, 2.1, "عنوان موضوعي", "المستخدمون المستهدفون\n\nيوضح المجال فقط، لكنه لا يقول لماذا هذه الفئة مهمة.", { headingColor: C.danger, line: "FEE2E2" });
  card(s, 1.05, 2.2, 5.35, 2.1, "عنوان فعلي", "بائعات الطعام المنزلي أفضل نقطة بداية لأن ألم الربح يومي ومتكرر\n\nهذا عنوان يعلن الاستنتاج ويطلب من الجسم إثباته.", { headingColor: C.brand, line: C.brand });
  card(s, 1.05, 5.05, 11.15, 0.85, "قاعدة تطبيقية", "إذا قرأ المستثمر عناوين الشرائح فقط، يجب أن يفهم لماذا دفتر، ولماذا الآن، ولماذا هذه الفئة، وماذا سنبني أولًا.", { line: C.border });
  footer(s, 6);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "التدفق الأفقي يحكي قصة دفتر من السوق إلى الخطة", "كل شريحة يجب أن تجعل التالية ضرورية.");
  const items = [
    ["1", "السوق", "العمل الحر والأسر المنتجة كبير، لكن أدواته اليومية ضعيفة."],
    ["2", "الألم", "الربح والمديونية وتكلفة المنتج غير مرئية."],
    ["3", "الحل", "دفتر يبني حول لحظة ربح واضحة لا حول نظام محاسبي كامل."],
    ["4", "الخطة", "MVP مركز، ثم نمو مباشر، ثم شراكات B2B2C."],
  ];
  items.forEach((it, i) => {
    const x = 9.8 - i * 3.05;
    card(s, x, 2.5, 2.55, 2.2, it[1], it[2], { num: it[0], line: i === 3 ? C.brand : C.softBorder });
    if (i < 3) arrow(s, x - 0.18, 3.62, x - 0.55, 3.62);
  });
  footer(s, 7);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "التدفق العمودي يثبت عنوان الشريحة بدون أن يضيع القارئ", "عنوان واحد، ثلاثة أدلة، ثم معنى عملي.");
  card(s, 1.05, 2.05, 11.15, 3.9, "بائعات الطعام المنزلي أفضل نقطة بداية لأن ألم الربح يومي ومتكرر", "", { line: C.border });
  card(s, 8.15, 3.25, 3.2, 1.65, "الدليل 1", "15–30 طلبًا أسبوعيًا يخلق تكرار استخدام طبيعي.", {});
  card(s, 4.85, 3.25, 3.2, 1.65, "الدليل 2", "المكونات والتغليف والتوصيل تجعل هامش المنتج غير بديهي.", {});
  card(s, 1.55, 3.25, 3.2, 1.65, "المعنى", "ابدأ بحاسبة تكلفة + فاتورة + تقرير ربح قبل ميزات التوسع.", { line: C.brand });
  footer(s, 8);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "Slide skeleton لعرض دفتر يربط كل شريحة بدليل وقرار", "هذا هو الهيكل العملي قبل التصميم النهائي.");
  dotDash(s, 1.05, 2.1, [
    { dot: "عنوان فعلي", dash: "الاستنتاج الذي نريد إثباته في الشريحة." },
    { dot: "المعرض", dash: "مقارنة، رحلة مستخدمة، جدول فجوة، أو لوحة منتج." },
    { dot: "النقاط الداعمة", dash: "3 أدلة كحد أقصى حتى لا تتحول الشريحة إلى تقرير." },
    { dot: "المعنى العملي", dash: "ماذا يعني هذا للـ MVP أو النمو أو الشراكة؟" },
    { dot: "الانتقال", dash: "لماذا تقود هذه الشريحة إلى الشريحة التالية؟" },
  ], 7.2);
  card(s, 8.65, 2.1, 3.55, 3.5, "مثال skeleton", "العنوان: دفتر يبدأ من الربح لا المحاسبة\n\nالمعرض: رحلة من واتساب إلى الربح الشهري\n\nالدعم: فاتورة، مصروف، تكلفة منتج\n\nالمعنى: MVP بثلاث لحظات فقط", { line: C.brand });
  footer(s, 9);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "MVP دفتر يجب أن يثبت ثلاث فرضيات قبل التوسع", "التحقق الاستشاري يحمي المنتج من بناء نظام أكبر من حاجة البداية.");
  card(s, 8.75, 2.15, 3.4, 2.25, "فرضية الألم", "هل المستخدمة تريد فعلًا معرفة الربح، أم تكتفي بتسجيل المبيعات؟", { num: "1" });
  card(s, 4.93, 2.15, 3.4, 2.25, "فرضية السلوك", "هل ستسجل الفاتورة والمصروف في لحظة العمل، لا آخر الشهر؟", { num: "2" });
  card(s, 1.1, 2.15, 3.4, 2.25, "فرضية الدفع", "هل ترى قيمة شهرية تستحق 29–49 ريال بعد إثبات الفائدة؟", { num: "3", line: C.brand });
  card(s, 1.1, 5.0, 11.05, 0.85, "مؤشرات النجاح", "Activation: أول فاتورة خلال 24 ساعة · D7 retention ≥ 40% · NPS ≥ 50 · Free-to-paid ≥ 15% بعد PMF", { line: C.brand });
  footer(s, 10);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "خارطة النمو تبدأ بعضوية مباشرة ثم تتحول إلى شراكات موثوقة", "التوسع لا يبدأ بإعلان واسع؛ يبدأ بقناة لها ثقة موجودة.");
  card(s, 8.75, 2.1, 3.4, 2.3, "المرحلة 1", "اكتساب مباشر عبر مجتمعات واتساب ومحتوى تعليمي لبائعات الطعام المنزلي.", { num: "1" });
  card(s, 4.93, 2.1, 3.4, 2.3, "المرحلة 2", "نمو بالإحالة: فاتورة PDF تجعل العميل يرى دفتر ويسأل عنه.", { num: "2" });
  card(s, 1.1, 2.1, 3.4, 2.3, "المرحلة 3", "B2B2C مع جهات مثل بنك التنمية لتوزيع موثوق وبيانات أثر مجمعة.", { num: "3", line: C.brand });
  dotDash(s, 1.1, 5.12, [
    { dot: "الأصل", dash: "الثقة المحلية أهم من الإنفاق الإعلاني المبكر." },
    { dot: "الحل", dash: "اجعل كل فاتورة وكل تقرير قناة نمو صغيرة." },
  ], 10.8);
  footer(s, 11);
}

{
  const s = pptx.addSlide();
  addBg(s);
  headline(s, "الخلاصة: قصة دفتر الاستثمارية هي البساطة المركزة لا شمولية المحاسبة", "هذه هي الرسالة التي يجب أن تبقى ثابتة في كل نسخة من العرض.");
  dotDash(s, 1.1, 2.15, [
    { dot: "لماذا دفتر؟", dash: "لأن الفئة لا تحتاج برنامج محاسبة؛ تحتاج رقم ربح تثق به." },
    { dot: "لماذا الآن؟", dash: "لأن البيع المنزلي والعمل الحر أصبحا رسميين ورقميين، لكن الأدوات متأخرة." },
    { dot: "لماذا سنفوز؟", dash: "لأن المنتج مصمم بلغة السوق، للجوال، ولحظة القرار اليومية." },
    { dot: "ماذا بعد؟", dash: "MVP مركز، قياس صارم، ثم شراكة توزيع تثبت الأثر." },
  ], 11.1);
  card(s, 1.1, 5.65, 11.05, 0.75, "جملة الإغلاق", "دفتر — حساباتك، بلغتك. اعرف ربحك قبل أن يكبر التخمين.", { line: C.brand });
  footer(s, 12, "دفتر — صنع في السعودية، للسعودية");
}

pptx.writeFile({ fileName: pptxPath });
