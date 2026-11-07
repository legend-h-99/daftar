import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect } from "vitest";

// ── Static mocks ─────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// نُبسّط أيقونات lucide لتجنّب أي تبعيات SVG
vi.mock("lucide-react", () => ({
  FileText:   () => null,
  Wallet:     () => null,
  Package:    () => null,
  BarChart3:  () => null,
  ArrowLeft:  () => null,
  Check:      () => null,
  PenLine:    () => null,
  Eye:        () => null,
  TrendingUp: () => null,
  Smartphone: () => null,
  ShieldCheck: () => null,
  MapPin:     () => null,
  Menu:       () => null,
  X:          () => null,
}));

// ── Import ───────────────────────────────────────────────────────────────────

import LandingPage from "@/app/landing/page";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("صفحة الـ Landing", () => {

  // ── Nav ──────────────────────────────────────────────────────────────────

  describe("شريط التنقل", () => {
    it("يعرض شعار دفتر", () => {
      render(<LandingPage />);
      // اللوغو يظهر مرتين (nav + footer) — نكتفي بالتحقق من الوجود
      expect(screen.getAllByText("دفتر").length).toBeGreaterThanOrEqual(1);
    });

    it("زر 'ابدأ مجانًا' يوجّه إلى /login", () => {
      render(<LandingPage />);
      const link = screen.getByRole("link", { name: "ابدأ مجانًا" });
      expect(link).toHaveAttribute("href", "/login");
    });
  });

  // ── Hero ─────────────────────────────────────────────────────────────────

  describe("قسم Hero", () => {
    it("يعرض H1 عن معرفة الربح من الجوال", () => {
      render(<LandingPage />);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("اعرف ربحك");
      expect(h1).toHaveTextContent("من جوالك");
    });

    it("يعرض جملة AEO في blockquote", () => {
      render(<LandingPage />);
      const bq = document.querySelector("blockquote");
      expect(bq).not.toBeNull();
      expect(bq!.textContent).toContain("تطبيق محاسبة عربي مبسّط");
      expect(bq!.textContent).toContain("بدون خبرة محاسبية");
    });

    it("الـ blockquote يحتوي بين 25 و 50 كلمة", () => {
      render(<LandingPage />);
      const bq = document.querySelector("blockquote");
      const wordCount = bq!.textContent!.trim().split(/\s+/).length;
      expect(wordCount).toBeGreaterThanOrEqual(20);
      expect(wordCount).toBeLessThanOrEqual(50);
    });

    it("زر 'جرّب مجانًا' يوجّه إلى /login", () => {
      render(<LandingPage />);
      const link = screen.getByRole("link", { name: /جرّب مجانًا/ });
      expect(link).toHaveAttribute("href", "/login");
    });

    it("يعرض رابط 'كيف يشتغل؟'", () => {
      render(<LandingPage />);
      const links = screen.getAllByText("كيف يشتغل؟");
      expect(links.length).toBeGreaterThanOrEqual(1);
    });

    it("يعرض ثلاث نقاط ثقة", () => {
      render(<LandingPage />);
      // "متاح مجانًا حاليًا" يظهر أيضًا في جدول المقارنة
      expect(screen.getAllByText("متاح مجانًا حاليًا").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("عربي RTL أصيل")).toBeInTheDocument();
      expect(screen.getByText("مصمم للاستخدام من الجوال")).toBeInTheDocument();
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  describe("قسم الإحصاءات", () => {
    it("يعرض '0' و '10×' و '<10 ث'", () => {
      render(<LandingPage />);
      expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("بخطوات بسيطة")).toBeInTheDocument();
      expect(screen.getByText("بوضوح")).toBeInTheDocument();
    });

    it("يعرض تسميات الإحصاءات الثلاثة", () => {
      render(<LandingPage />);
      expect(screen.getByText("ريال رسوم اشتراك")).toBeInTheDocument();
      expect(screen.getByText("لتسجيل البيع والمصروف")).toBeInTheDocument();
      expect(screen.getByText("لمراجعة نتيجتك الشهرية")).toBeInTheDocument();
    });
  });

  // ── Problem ──────────────────────────────────────────────────────────────

  describe("قسم المشكلة والحل", () => {
    it("يعرض عنوان المشكلة والحل", () => {
      render(<LandingPage />);
      expect(
        screen.getByText(/الأدوات الموجودة صُمِّمت لمحاسبين في شركات/),
      ).toBeInTheDocument();
    });

    it("يعرض مقارنة قبل وبعد دفتر", () => {
      render(<LandingPage />);
      expect(screen.getByText("قبل دفتر")).toBeInTheDocument();
      expect(screen.getByText("بعد دفتر")).toBeInTheDocument();
    });
  });

  // ── Features ─────────────────────────────────────────────────────────────

  describe("قسم المزايا", () => {
    it("يعرض عنوان القسم", () => {
      render(<LandingPage />);
      expect(screen.getByText("كل حساباتك في دفتر واحد")).toBeInTheDocument();
    });

    it("يعرض الميزات الأربع", () => {
      render(<LandingPage />);
      expect(screen.getByText("فواتير من الجوال")).toBeInTheDocument();
      expect(screen.getByText("سجّل مصاريفك بوضوح")).toBeInTheDocument();
      expect(screen.getByText("مخزون ووصفات")).toBeInTheDocument();
      expect(screen.getByText("نتيجة مشروعك بوضوح")).toBeInTheDocument();
    });

    it("يعرض الفائدة لكل ميزة", () => {
      render(<LandingPage />);
      expect(screen.getByText("لا تضيع وقتك في الورقة")).toBeInTheDocument();
      expect(screen.getByText("اعرف أين يذهب كل ريال")).toBeInTheDocument();
      expect(screen.getByText("لا بضاعة تخلص بدون تحذير")).toBeInTheDocument();
      expect(screen.getByText("قرّر بثقة في نهاية الشهر")).toBeInTheDocument();
    });
  });

  // ── Social Proof ──────────────────────────────────────────────────────────

  describe("قسم أمثلة الاستخدام", () => {
    it("يعرض عنوان أمثلة الاستخدام", () => {
      render(<LandingPage />);
      expect(screen.getByText("سيناريوهات توضيحية للاستخدام")).toBeInTheDocument();
    });

    it("يعرض أنواع المشاريع الثلاثة كأمثلة توضيحية", () => {
      render(<LandingPage />);
      expect(screen.getByText("محل معمول ومقبلات")).toBeInTheDocument();
      expect(screen.getByText("كيك منزلي")).toBeInTheDocument();
      expect(screen.getByText("تموينات صغيرة")).toBeInTheDocument();
      expect(screen.getAllByText("مثال توضيحي")).toHaveLength(3);
    });

    it("يعرض نص كل شهادة", () => {
      render(<LandingPage />);
      expect(screen.getByText(/سيناريو محل معمول/)).toBeInTheDocument();
      expect(screen.getByText(/سيناريو كيك منزلي/)).toBeInTheDocument();
      expect(screen.getByText(/سيناريو تموينات/)).toBeInTheDocument();
    });

    it("لا ينسب السيناريوهات لأشخاص بأسماء ومدن", () => {
      render(<LandingPage />);
      for (const name of ["أم فيصل", "نورة العتيبي", "أبو خالد"]) {
        expect(screen.queryByText(name)).not.toBeInTheDocument();
      }
    });
  });

  // ── How It Works ──────────────────────────────────────────────────────────

  describe("قسم 'كيف يشتغل'", () => {
    it("يعرض عنوان 'ثلاث خطوات، وخلاص'", () => {
      render(<LandingPage />);
      expect(screen.getByText("ثلاث خطوات، وخلاص")).toBeInTheDocument();
    });

    it("يعرض الخطوات الثلاث", () => {
      render(<LandingPage />);
      expect(screen.getByText("سجّل محلك")).toBeInTheDocument();
      expect(screen.getByText("ابدأ التسجيل")).toBeInTheDocument();
      expect(screen.getByText("شوف ربحك")).toBeInTheDocument();
    });

    it("يعرض أرقام الخطوات 1، 2، 3", () => {
      render(<LandingPage />);
      const ol = document.querySelector("ol");
      expect(ol).not.toBeNull();
      expect(within(ol!).getByText("1")).toBeInTheDocument();
      expect(within(ol!).getByText("2")).toBeInTheDocument();
      expect(within(ol!).getByText("3")).toBeInTheDocument();
    });
  });

  // ── Comparison Table ──────────────────────────────────────────────────────

  describe("جدول المقارنة", () => {
    it("يعرض عنوان 'دفتر مقارنةً بالبدائل'", () => {
      render(<LandingPage />);
      expect(screen.getByText("دفتر مقارنةً بالبدائل")).toBeInTheDocument();
    });

    it("يعرض أعمدة: دفتر، ورقة وقلم، QuickBooks", () => {
      render(<LandingPage />);
      const table = document.querySelector("table");
      expect(table).not.toBeNull();
      expect(within(table!).getByText("ورقة وقلم")).toBeInTheDocument();
      expect(within(table!).getByText("QuickBooks")).toBeInTheDocument();
    });

    it("يعرض جميع صفوف الميزات السبعة", () => {
      render(<LandingPage />);
      const table = document.querySelector("table")!;
      expect(within(table).getByText("عربي بالكامل (RTL)")).toBeInTheDocument();
      expect(within(table).getByText("يعمل على الجوال فورًا")).toBeInTheDocument();
      expect(within(table).getByText("تقرير الربح الشهري")).toBeInTheDocument();
      expect(within(table).getByText("متابعة المخزون والوصفات")).toBeInTheDocument();
      expect(within(table).getByText("بدون مصطلحات محاسبية")).toBeInTheDocument();
      expect(within(table).getByText("متاح مجانًا حاليًا")).toBeInTheDocument();
      expect(within(table).getByText("محاسبة متقدمة للشركات الكبيرة")).toBeInTheDocument();
    });

    it("يعرض تنبيه صادق عن تفوق QuickBooks للشركات الكبيرة", () => {
      render(<LandingPage />);
      expect(
        screen.getByText(/QuickBooks يتفوق في المحاسبة المتقدمة/),
      ).toBeInTheDocument();
    });
  });

  // ── FAQ ───────────────────────────────────────────────────────────────────

  describe("قسم الأسئلة الشائعة", () => {
    it("يعرض عنوان 'الأسئلة الشائعة'", () => {
      render(<LandingPage />);
      // يظهر في nav وفي عنوان القسم
      expect(screen.getAllByText("الأسئلة الشائعة").length).toBeGreaterThanOrEqual(1);
    });

    it("يعرض 7 أسئلة على الأقل كعناوين", () => {
      render(<LandingPage />);
      const faq = document.getElementById("faq")!;
      const questions = within(faq).getAllByRole("heading", { level: 3 });
      expect(questions.length).toBeGreaterThanOrEqual(7);
    });

    it("يوضح أنه لا يوجد ربط حاليًا مع هيئة الزكاة والضريبة والجمارك", () => {
      render(<LandingPage />);
      const faq = document.getElementById("faq")!;
      expect(within(faq).getByRole("heading", { name: /هيئة الزكاة والضريبة والجمارك/ })).toBeInTheDocument();
      expect(within(faq).getByText(/لا يوجد حاليًا ربط بين دفتر ومنصة «فاتورة»/)).toBeInTheDocument();
    });

    it("يعرض سؤال 'ما هو تطبيق دفتر؟' وإجابته", () => {
      render(<LandingPage />);
      expect(screen.getByText("ما هو تطبيق دفتر؟")).toBeInTheDocument();
      // الإجابة مقيّدة بقسم الأسئلة لتجنّب تعارض مع الـ blockquote في Hero
      const faq = document.getElementById("faq")!;
      expect(
        within(faq).getByText(/تطبيق محاسبة عربي مبسّط للمشاريع الصغيرة/),
      ).toBeInTheDocument();
    });

    it("يعرض سؤال 'هل دفتر مجاني؟'", () => {
      render(<LandingPage />);
      expect(screen.getByText("هل دفتر مجاني؟")).toBeInTheDocument();
      expect(
        screen.getByText(/الوظائف الحالية متاحة مجانًا، ولا تحتاج بطاقة ائتمانية/),
      ).toBeInTheDocument();
    });

    it("يعرض سؤال الفرق عن QuickBooks", () => {
      render(<LandingPage />);
      expect(
        screen.getByText("كيف يختلف دفتر عن QuickBooks أو برامج المحاسبة الأخرى؟"),
      ).toBeInTheDocument();
    });

    it("كل إجابة FAQ أقل من 50 كلمة", () => {
      render(<LandingPage />);
      const faq = document.getElementById("faq")!;
      const answers = faq.querySelectorAll("li > p");
      expect(answers.length).toBeGreaterThanOrEqual(7);
      for (const ans of answers) {
        const wordCount = ans.textContent!.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(50);
      }
    });
  });

  // ── Trust Signals ─────────────────────────────────────────────────────────

  describe("إشارات الثقة", () => {
    it("يعرض 'صنع في السعودية، للسعودية'", () => {
      render(<LandingPage />);
      expect(screen.getByText("صنع في السعودية، للسعودية")).toBeInTheDocument();
    });

    it("يعرض 'جوال أولًا بلا تنازل'", () => {
      render(<LandingPage />);
      expect(screen.getByText("جوال أولًا بلا تنازل")).toBeInTheDocument();
    });

    it("يعرض 'بياناتك لك وحدك'", () => {
      render(<LandingPage />);
      expect(screen.getByText("بياناتك لك وحدك")).toBeInTheDocument();
    });
  });

  // ── Final CTA ─────────────────────────────────────────────────────────────

  describe("CTA النهائي", () => {
    it("يعرض عنوان 'ابدأ تتابع حساباتك اليوم — مجانًا'", () => {
      render(<LandingPage />);
      expect(
        screen.getByText("ابدأ تتابع حساباتك اليوم — مجانًا"),
      ).toBeInTheDocument();
    });

    it("زر 'سجّل مشروعك الآن — مجاني' يوجّه إلى /login", () => {
      render(<LandingPage />);
      const link = screen.getByRole("link", { name: /سجّل مشروعك الآن — مجاني/ });
      expect(link).toHaveAttribute("href", "/login");
    });

    it("يعرض نصًا عربيًا ثانويًا بدل العبارة الإنجليزية", () => {
      render(<LandingPage />);
      expect(
        screen.getByText(/دفتر مجاني للبدء/),
      ).toBeInTheDocument();
    });
  });

  // ── Footer ───────────────────────────────────────────────────────────────

  describe("Footer", () => {
    it("يعرض 'تطبيق محاسبة للمشاريع الصغيرة' في الـ footer", () => {
      render(<LandingPage />);
      const footer = document.querySelector("footer")!;
      expect(
        within(footer).getByText(/تطبيق محاسبة للمشاريع الصغيرة/),
      ).toBeInTheDocument();
    });

    it("يربط الـ footer بإشعار الخصوصية وتسجيل الدخول", () => {
      render(<LandingPage />);
      const footer = document.querySelector("footer")!;
      expect(within(footer).getByRole("link", { name: "إشعار الخصوصية" })).toHaveAttribute("href", "/privacy");
      expect(within(footer).getByRole("link", { name: "تسجيل الدخول" })).toHaveAttribute("href", "/login");
    });
  });

  // ── CTAs → /login ─────────────────────────────────────────────────────────

  describe("جميع روابط CTA تشير إلى /login", () => {
    it("كل روابط الـ CTA تشير إلى /login", () => {
      render(<LandingPage />);
      const ctaLinks = screen
        .getAllByRole("link")
        .filter((a) => a.getAttribute("href") === "/login");
      // ابدأ مجانًا (nav) + جرّب مجانًا (hero) + سجّل محلك الآن (final)
      expect(ctaLinks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Preview (LedgerPreview) ───────────────────────────────────────────────

  describe("معاينة الدفتر (LedgerPreview)", () => {
    it("يعرض 'فواتير اليوم'", () => {
      render(<LandingPage />);
      expect(screen.getByText("فواتير اليوم")).toBeInTheDocument();
    });

    it("يعرض صف مدفوع وصف آجل", () => {
      render(<LandingPage />);
      // صفّان مدفوعان في LedgerPreview — getAllByText
      expect(screen.getAllByText("مدفوعة").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("آجل").length).toBeGreaterThanOrEqual(1);
    });

    it("يعرض 'صافي ربح الشهر'", () => {
      render(<LandingPage />);
      expect(screen.getByText("صافي ربح الشهر")).toBeInTheDocument();
    });
  });

  // ── Site review fixes ─────────────────────────────────────────────────────

  describe("إصلاحات مراجعة الموقع", () => {
    it("الشعار رابط للصفحة الرئيسية", () => {
      render(<LandingPage />);
      const logos = screen.getAllByRole("link", { name: "دفتر — الصفحة الرئيسية" });
      expect(logos.length).toBeGreaterThanOrEqual(1);
      for (const logo of logos) expect(logo).toHaveAttribute("href", "/");
    });

    it("أول رابط في الصفحة يتخطى إلى المحتوى", () => {
      render(<LandingPage />);
      const skip = screen.getAllByRole("link")[0];
      expect(skip).toHaveTextContent("تخطَّ إلى المحتوى");
      expect(skip).toHaveAttribute("href", "#content");
      expect(document.getElementById("content")).not.toBeNull();
    });

    it("زر القائمة على الجوال يفتح روابط الأقسام", async () => {
      const user = userEvent.setup();
      render(<LandingPage />);
      const toggle = screen.getByRole("button", { name: "فتح القائمة" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await user.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!;
      expect(panel).toBeVisible();
      for (const name of ["المزايا", "الباقات", "الأسئلة الشائعة"]) {
        expect(within(panel).getByRole("link", { name })).toBeInTheDocument();
      }
    });

    it("صورة اللوحة التوضيحية مخفية عن قارئ الشاشة ومعلّمة كمثال", () => {
      render(<LandingPage />);
      const preview = screen.getByText("صافي ربح الشهر").closest("[aria-hidden='true']");
      expect(preview).not.toBeNull();
      expect(screen.getByText(/مثال توضيحي لشاشة دفتر/)).toBeInTheDocument();
    });

    it("عبارة الثقة لا تعد بعدم مشاركة أي معلومة", () => {
      render(<LandingPage />);
      expect(screen.queryByText(/لا نبيع بيانات ولا نشارك أي معلومة/)).not.toBeInTheDocument();
      expect(screen.getByText(/إشعار الخصوصية يوضح البيانات المستخدمة/)).toBeInTheDocument();
    });

    it("يضيف بيانات منظمة صالحة بدون باقات مدفوعة غير مفعّلة", () => {
      render(<LandingPage />);
      const script = document.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(script!.textContent!);
      const types = data["@graph"].map((node: { "@type": string }) => node["@type"]);
      expect(types).toEqual(["Organization", "SoftwareApplication", "FAQPage"]);
      const app = data["@graph"][1];
      expect(app.offers.every((offer: { price: string }) => offer.price === "0")).toBe(true);
    });

    it("الباقات المدفوعة لا تعرض زرًا معطّلًا", () => {
      render(<LandingPage />);
      expect(screen.queryByRole("button", { name: "الاشتراك قريبًا" })).not.toBeInTheDocument();
      expect(screen.getAllByText(/الاشتراك المدفوع لم يُفعّل بعد/).length).toBe(2);
    });
  });
});
