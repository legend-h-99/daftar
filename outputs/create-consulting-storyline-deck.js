const path = require("path");
const PptxGenJS = require("pptxgenjs");

const outDir = __dirname;
const pptxPath = path.join(outDir, "consulting-storyline-training.pptx");

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "Daftar";
pptx.company = "Daftar";
pptx.subject = "Consulting storyline training";
pptx.title = "Storylining Like McKinsey, BCG, and Bain";
pptx.lang = "ar-SA";
pptx.theme = {
  headFontFace: "Tajawal",
  bodyFontFace: "Tajawal",
  lang: "ar-SA",
};
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";

const C = {
  brand: "0F7353",
  brand50: "EEFDF6",
  ink: "101914",
  muted: "6B7280",
  tertiary: "9CA3AF",
  surface: "F7F8F7",
  card: "FFFFFF",
  border: "E5E7EB",
  danger: "DC2626",
  warning: "B45309",
};

const W = 13.333;
const H = 7.5;
const margin = 0.72;

function addBg(slide) {
  slide.background = { color: C.surface };
  slide.addText("د", {
    x: W - margin - 0.46,
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

function addFooter(slide, idx, label = "Storylining · SCR/SCQA · Dot-dash · Slide skeleton") {
  slide.addShape(pptx.ShapeType.line, {
    x: margin,
    y: H - 0.55,
    w: W - margin * 2,
    h: 0,
    line: { color: C.border, width: 1 },
  });
  slide.addText(label, {
    x: margin,
    y: H - 0.42,
    w: 7,
    h: 0.22,
    fontFace: "Tajawal",
    fontSize: 7.5,
    color: C.tertiary,
    margin: 0,
  });
  slide.addText(String(idx).padStart(2, "0"), {
    x: W - margin - 0.4,
    y: H - 0.43,
    w: 0.4,
    h: 0.22,
    fontFace: "Tajawal",
    fontSize: 7.5,
    color: C.tertiary,
    align: "right",
    margin: 0,
  });
}

function title(slide, text, sub) {
  slide.addText(text, {
    x: margin,
    y: 0.82,
    w: 11.2,
    h: 0.75,
    fontFace: "Tajawal",
    fontSize: 26,
    bold: true,
    color: C.ink,
    fit: "shrink",
    margin: 0,
    breakLine: false,
  });
  if (sub) {
    slide.addText(sub, {
      x: margin,
      y: 1.62,
      w: 10.6,
      h: 0.45,
      fontFace: "Tajawal",
      fontSize: 12,
      color: C.muted,
      fit: "shrink",
      margin: 0,
    });
  }
}

function pill(slide, text, x, y, w = 1.7, color = C.brand) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.34,
    fontFace: "Tajawal",
    fontSize: 9,
    bold: true,
    color,
    fill: { color: color === C.brand ? C.brand50 : "FEF2F2" },
    margin: 0.07,
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
    line: { color: opts.line || "F3F4F6", width: 1 },
  });
  if (opts.num) {
    slide.addText(opts.num, {
      x: x + w - 0.72,
      y: y + 0.28,
      w: 0.42,
      h: 0.42,
      fontFace: "Tajawal",
      fontSize: 13,
      bold: true,
      color: C.brand,
      align: "center",
      valign: "mid",
      fill: { color: C.brand50 },
      radius: 0.12,
      margin: 0,
    });
  }
  slide.addText(heading, {
    x: x + 0.34,
    y: y + 0.32,
    w: w - 0.7,
    h: 0.34,
    fontFace: "Tajawal",
    fontSize: 13,
    bold: true,
    color: opts.headingColor || C.ink,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(body, {
    x: x + 0.34,
    y: y + 0.82,
    w: w - 0.68,
    h: h - 1.05,
    fontFace: "Tajawal",
    fontSize: 10.5,
    color: C.muted,
    breakLine: false,
    fit: "shrink",
    margin: 0,
    valign: "top",
  });
}

function dotDash(slide, x, y, rows) {
  rows.forEach((r, i) => {
    const yy = y + i * 0.72;
    slide.addText("•", { x, y: yy, w: 0.2, h: 0.3, fontSize: 16, color: C.brand, margin: 0 });
    slide.addText(r.dot, {
      x: x + 0.35,
      y: yy,
      w: 3.1,
      h: 0.3,
      fontFace: "Tajawal",
      fontSize: 12.5,
      bold: true,
      color: C.ink,
      margin: 0,
      fit: "shrink",
    });
    slide.addText("– " + r.dash, {
      x: x + 3.55,
      y: yy + 0.03,
      w: 6.4,
      h: 0.35,
      fontFace: "Tajawal",
      fontSize: 10.8,
      color: C.muted,
      margin: 0,
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
    line: { color: C.brand, width: 1.2, beginArrowType: "none", endArrowType: "triangle" },
  });
}

const slides = [];

{
  const s = pptx.addSlide();
  addBg(s);
  pill(s, "Consulting storytelling", margin, 0.86, 2.15);
  s.addText("Storylining like McKinsey, BCG, and Bain", {
    x: margin,
    y: 1.55,
    w: 8.4,
    h: 1.2,
    fontFace: "Tajawal",
    fontSize: 31,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: "shrink",
  });
  s.addText("A practical deck on SCR/SCQA, dot-dash writing, and slide skeletons", {
    x: margin,
    y: 2.88,
    w: 6.6,
    h: 0.45,
    fontFace: "Tajawal",
    fontSize: 13,
    color: C.muted,
    margin: 0,
  });
  card(s, 8.35, 1.45, 3.7, 3.55, "The core idea", "A good consulting deck is not a collection of slides. It is a chain of answers that makes the recommendation feel inevitable.", { line: C.brand });
  addFooter(s, 1, "Training deck");
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Start with the answer, then earn it", "The reader should understand the recommendation before studying the analysis.");
  card(s, margin, 2.3, 3.55, 2.3, "Typical report", "Context first, analysis second, answer near the end. Useful for exploration, slow for executives.", { num: "1" });
  card(s, 4.86, 2.3, 3.55, 2.3, "Consulting storyline", "Answer first, then supporting logic, then evidence. Built for decision-making.", { num: "2", line: C.brand });
  card(s, 9.0, 2.3, 3.55, 2.3, "Slide skeleton", "Each slide proves one step in the logic using an action title and structured support.", { num: "3" });
  arrow(s, 4.3, 3.45, 4.7, 3.45);
  arrow(s, 8.45, 3.45, 8.85, 3.45);
  addFooter(s, 2);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Use SCR when the story is a change journey", "Situation, Complication, Resolution gives the audience a reason to move.");
  card(s, margin, 2.1, 3.5, 2.3, "Situation", "What is true today?\nSet shared context without arguing.", { num: "S" });
  card(s, 4.9, 2.1, 3.5, 2.3, "Complication", "What changed or broke?\nIntroduce tension that requires action.", { num: "C", line: C.warning });
  card(s, 9.08, 2.1, 3.5, 2.3, "Resolution", "What should we do?\nState the answer as a decision.", { num: "R", line: C.brand });
  arrow(s, 4.35, 3.25, 4.75, 3.25);
  arrow(s, 8.48, 3.25, 8.9, 3.25);
  dotDash(s, margin, 5.15, [
    { dot: "Situation", dash: "Current growth is strong, but concentrated in two channels." },
    { dot: "Complication", dash: "CAC rose 38%, making the old channel mix uneconomic." },
    { dot: "Resolution", dash: "Shift spend to partner-led acquisition and pause low-LTV search campaigns." },
  ]);
  addFooter(s, 3);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Use SCQA when the audience needs a sharper question", "Situation, Complication, Question, Answer turns ambiguity into a decision frame.");
  const xs = [margin, 3.95, 7.18, 10.4];
  [
    ["S", "Situation", "The business has launched successfully."],
    ["C", "Complication", "Growth is slowing despite higher spend."],
    ["Q", "Question", "Where should leadership focus next?"],
    ["A", "Answer", "Prioritize retention before more acquisition."],
  ].forEach((v, i) => card(s, xs[i], 2.2, 2.45, 2.15, v[1], v[2], { num: v[0], line: i === 3 ? C.brand : "F3F4F6" }));
  arrow(s, 3.4, 3.25, 3.78, 3.25);
  arrow(s, 6.62, 3.25, 7.0, 3.25);
  arrow(s, 9.84, 3.25, 10.22, 3.25);
  card(s, margin, 5.02, 11.9, 0.9, "Rule of thumb", "If the answer is obvious once the complication is clear, use SCR. If the complication creates several possible choices, use SCQA.", { line: C.brand });
  addFooter(s, 4);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Write the storyline as dot-dash before making slides", "Dots are governing thoughts; dashes are the evidence each thought needs.");
  dotDash(s, margin, 2.25, [
    { dot: "Recommendation", dash: "Launch the pilot in one city before scaling nationally." },
    { dot: "Why it matters", dash: "The target segment has urgent pain, but onboarding risk is high." },
    { dot: "Why this route", dash: "A city pilot validates adoption, support load, and unit economics quickly." },
    { dot: "What to do next", dash: "Select users, define measures, and decide scale criteria before launch." },
  ]);
  card(s, 8.35, 2.18, 3.8, 2.6, "Quality check", "Every dot should be a sentence you could say in a meeting. Every dash should explain why the dot is true.", { line: C.brand });
  addFooter(s, 5);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Action titles turn slides into arguments", "A slide title should say the conclusion, not the topic.");
  card(s, margin, 2.1, 5.5, 2.0, "Topic title", "Market overview\n\nThis tells the reader what the slide is about, but not what they should conclude.", { headingColor: C.danger, line: "FEE2E2" });
  card(s, 6.95, 2.1, 5.5, 2.0, "Action title", "The market is large enough to support a focused premium entry\n\nThis tells the reader the claim the slide will prove.", { headingColor: C.brand, line: C.brand });
  card(s, margin, 4.85, 11.75, 1.0, "Rewrite test", "If the title can sit in a table of contents and still tell the whole story, it is probably an action title.", { line: C.border });
  addFooter(s, 6);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Horizontal flow is the story across slides", "The sequence should read like a memo even before charts are added.");
  const items = [
    ["1", "Problem", "Growth is slowing for structural reasons."],
    ["2", "Root cause", "Retention, not acquisition, is the bottleneck."],
    ["3", "Options", "Three moves exist, but only one fits constraints."],
    ["4", "Recommendation", "Invest in retention now, then resume growth spend."],
  ];
  items.forEach((it, i) => {
    const x = margin + i * 3.08;
    card(s, x, 2.5, 2.55, 2.2, it[1], it[2], { num: it[0], line: i === 3 ? C.brand : "F3F4F6" });
    if (i < 3) arrow(s, x + 2.62, 3.62, x + 2.92, 3.62);
  });
  addFooter(s, 7);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Vertical flow is the logic inside one slide", "The title makes the claim; the body proves it without making the reader hunt.");
  s.addShape(pptx.ShapeType.roundRect, { x: margin, y: 2.05, w: 11.9, h: 3.9, rectRadius: 0.08, fill: { color: C.card }, line: { color: C.border } });
  s.addText("Retention is the binding constraint because churn absorbs most new acquisition", {
    x: 1.05,
    y: 2.42,
    w: 10.7,
    h: 0.45,
    fontFace: "Tajawal",
    fontSize: 16,
    bold: true,
    color: C.ink,
    margin: 0,
    fit: "shrink",
  });
  [
    ["Evidence 1", "Cohort retention drops below target by month 3"],
    ["Evidence 2", "Payback period extends beyond 14 months"],
    ["Implication", "Fix retention before scaling spend"],
  ].forEach((v, i) => card(s, 1.05 + i * 3.7, 3.35, 3.2, 1.65, v[0], v[1], { line: i === 2 ? C.brand : "F3F4F6" }));
  addFooter(s, 8);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Build the slide skeleton before designing the slide", "Skeletons reduce rework because logic and layout are decided together.");
  dotDash(s, margin, 2.15, [
    { dot: "Action title", dash: "The conclusion the slide must prove." },
    { dot: "Exhibit", dash: "The chart, table, process, or comparison that carries the proof." },
    { dot: "Support notes", dash: "Definitions, assumptions, or caveats needed for trust." },
    { dot: "Implication", dash: "The so-what that connects this slide to the next one." },
  ]);
  card(s, 8.1, 2.05, 4.15, 3.2, "Skeleton output", "1. Title claim\n2. Main visual\n3. Three proof points\n4. Footnote or source\n5. Transition to next slide", { line: C.brand });
  addFooter(s, 9);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Use this 6-step workflow for any consulting deck", "The workflow keeps thinking separate from formatting until the story is stable.");
  [
    ["1", "Frame", "Define audience, decision, and constraints."],
    ["2", "Choose", "Pick SCR or SCQA."],
    ["3", "Draft", "Write dot-dash storyline."],
    ["4", "Map", "Create horizontal slide flow."],
    ["5", "Skeleton", "Draft action titles and exhibits."],
    ["6", "Build", "Design slides only after logic holds."],
  ].forEach((v, i) => {
    const x = margin + (i % 3) * 4.05;
    const y = 2.15 + Math.floor(i / 3) * 1.75;
    card(s, x, y, 3.5, 1.32, v[1], v[2], { num: v[0], line: i === 5 ? C.brand : "F3F4F6" });
  });
  addFooter(s, 10);
}

{
  const s = pptx.addSlide();
  addBg(s);
  title(s, "Final checklist: a strong storyline passes five tests", "Use this before sharing a draft with leadership.");
  dotDash(s, margin, 2.05, [
    { dot: "Answer first", dash: "The recommendation is visible by slide 2." },
    { dot: "One idea", dash: "Each slide proves only one governing thought." },
    { dot: "Logical order", dash: "Each slide makes the next one feel necessary." },
    { dot: "Specific titles", dash: "Titles are conclusions with verbs, numbers, or direction." },
    { dot: "Evidence fit", dash: "Every exhibit directly proves the action title." },
  ]);
  card(s, 8.25, 2.45, 3.9, 2.2, "Best final question", "If a busy executive read only the titles, would they understand the full recommendation and why it is right?", { line: C.brand });
  addFooter(s, 11);
}

pptx.writeFile({ fileName: pptxPath });
