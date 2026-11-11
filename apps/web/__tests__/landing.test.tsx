import { render, screen, within } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
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
      const link = screen.getAllByRole("link", { name: "ابدأ مجانًا" })[0];
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

    it("يشرح الفائدة بلغة المستخدم", () => {
      render(<LandingPage />);
      expect(screen.getByText(/سجّل مبيعاتك ومصاريفك وتكلفة منتجاتك/)).toHaveTextContent("بدون خبرة محاسبية");
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
      expect(screen.getByText("مصمم بالعربي")).toBeInTheDocument();
      expect(screen.getByText("من جوالك")).toBeInTheDocument();
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

  it("يسمح بتجربة البيعة وإعادتها دون حساب", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    expect(screen.getByRole("status")).toHaveTextContent("0 ريال");
    await user.click(screen.getByRole("button", { name: "سجّل البيعة التجريبية" }));
    expect(screen.getByRole("status")).toHaveTextContent("60 ريالًا");
    await user.click(screen.getByRole("button", { name: "إعادة المثال" }));
    expect(screen.getByRole("status")).toHaveTextContent("0 ريال");
  });

  it("يفصل الأسعار المقترحة عن العرض المجاني الحالي", () => {
    render(<LandingPage />);
    const details = document.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("29")).toBeInTheDocument();
    expect(screen.getByText(/لا يتم تحصيل أي مبلغ الآن/)).toBeVisible();
    expect(screen.getByText(/أمثلة توضيحية للاستخدام، وليست شهادات عملاء/)).toBeInTheDocument();
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
      const dl = document.querySelector("#faq dl");
      expect(dl).not.toBeNull();
      const questions = within(dl!).getAllByRole("term");
      expect(questions.length).toBeGreaterThanOrEqual(7);
    });

    it("يعرض سؤال 'ما هو تطبيق دفتر؟' وإجابته", () => {
      render(<LandingPage />);
      expect(screen.getByText("ما هو تطبيق دفتر؟")).toBeInTheDocument();
      // الإجابة مقيّدة بالـ dl لتجنّب تعارض مع الـ blockquote في Hero
      const dl = document.querySelector("#faq dl")!;
      expect(
        within(dl).getByText(/تطبيق محاسبة عربي مبسّط للمشاريع الصغيرة/),
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
      const dl = document.querySelector("#faq dl");
      const answers = within(dl!).getAllByRole("definition");
      for (const ans of answers) {
        const wordCount = ans.textContent!.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(50);
      }
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
});
