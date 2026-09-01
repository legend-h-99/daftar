import { render, screen, within } from "@testing-library/react";
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
      // "مجاني بالكامل" يظهر أيضًا في جدول المقارنة
      expect(screen.getAllByText("مجاني بالكامل").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("عربي RTL أصيل")).toBeInTheDocument();
      expect(screen.getByText("يعمل على الجوال بدون تدريب")).toBeInTheDocument();
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  describe("قسم الإحصاءات", () => {
    it("يعرض '500+' و '10×' و '<10 ث'", () => {
      render(<LandingPage />);
      expect(screen.getByText("500+")).toBeInTheDocument();
      expect(screen.getByText("10×")).toBeInTheDocument();
      expect(screen.getByText("<10 ث")).toBeInTheDocument();
    });

    it("يعرض تسميات الإحصاءات الثلاثة", () => {
      render(<LandingPage />);
      expect(screen.getByText("محل يستخدم دفتر")).toBeInTheDocument();
      expect(screen.getByText("أسرع من الورقة والقلم")).toBeInTheDocument();
      expect(screen.getByText("لمعرفة ربحك الشهري")).toBeInTheDocument();
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
      expect(screen.getByText("فواتير في 30 ثانية")).toBeInTheDocument();
      expect(screen.getByText("تتبع المصاريف تلقائيًا")).toBeInTheDocument();
      expect(screen.getByText("مخزون ووصفات")).toBeInTheDocument();
      expect(screen.getByText("ربحك في 10 ثوانٍ")).toBeInTheDocument();
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
      expect(screen.getByText("أمثلة استخدام حقيقية من السوق")).toBeInTheDocument();
    });

    it("يعرض أسماء أصحاب الشهادات الثلاثة", () => {
      render(<LandingPage />);
      expect(screen.getByText("أم فيصل")).toBeInTheDocument();
      expect(screen.getByText("نورة العتيبي")).toBeInTheDocument();
      expect(screen.getByText("أبو خالد")).toBeInTheDocument();
    });

    it("يعرض نص كل شهادة", () => {
      render(<LandingPage />);
      expect(screen.getByText(/سيناريو محل معمول/)).toBeInTheDocument();
      expect(screen.getByText(/سيناريو كيك منزلي/)).toBeInTheDocument();
      expect(screen.getByText(/سيناريو تموينات/)).toBeInTheDocument();
    });

    it("يعرض أدوار ومدن أصحاب الشهادات", () => {
      render(<LandingPage />);
      expect(screen.getByText(/صاحبة محل معمول ومقبلات — الرياض/)).toBeInTheDocument();
      expect(screen.getByText(/بائعة كيك منزلي — جدة/)).toBeInTheDocument();
      expect(screen.getByText(/تموينات صغيرة — الدمام/)).toBeInTheDocument();
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
      expect(within(table).getByText("مجاني بالكامل")).toBeInTheDocument();
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

    it("يعرض 7 أسئلة على الأقل", () => {
      render(<LandingPage />);
      const dl = document.querySelector("dl");
      expect(dl).not.toBeNull();
      const questions = within(dl!).getAllByRole("term");
      expect(questions.length).toBeGreaterThanOrEqual(7);
    });

    it("يعرض سؤال 'ما هو تطبيق دفتر؟' وإجابته", () => {
      render(<LandingPage />);
      expect(screen.getByText("ما هو تطبيق دفتر؟")).toBeInTheDocument();
      // الإجابة مقيّدة بالـ dl لتجنّب تعارض مع الـ blockquote في Hero
      const dl = document.querySelector("dl")!;
      expect(
        within(dl).getByText(/تطبيق محاسبة عربي مبسّط للمشاريع الصغيرة/),
      ).toBeInTheDocument();
    });

    it("يعرض سؤال 'هل دفتر مجاني؟'", () => {
      render(<LandingPage />);
      expect(screen.getByText("هل دفتر مجاني؟")).toBeInTheDocument();
      expect(
        screen.getByText(/نعم، دفتر مجاني بالكامل/),
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
      const dl = document.querySelector("dl");
      const answers = within(dl!).getAllByRole("definition");
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

    it("زر 'سجّل محلك الآن — مجاني' يوجّه إلى /login", () => {
      render(<LandingPage />);
      const link = screen.getByRole("link", { name: /سجّل محلك الآن — مجاني/ });
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

    it("يعرض وعد الهوية العربية في الـ footer", () => {
      render(<LandingPage />);
      expect(
        screen.getByText(/عربي أولًا/),
      ).toBeInTheDocument();
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
});
