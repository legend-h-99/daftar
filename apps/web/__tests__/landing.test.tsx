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

    it("كل أزرار 'ابدأ مجانًا' تشير إلى /login", () => {
      render(<LandingPage />);
      const links = screen.getAllByRole("link", { name: "ابدأ مجانًا" });
      expect(links.length).toBeGreaterThanOrEqual(3);
      for (const link of links) expect(link).toHaveAttribute("href", "/login");
    });

    it("يعرض رابط 'شوف مثالًا'", () => {
      render(<LandingPage />);
      const links = screen.getAllByText("شوف مثالًا");
      expect(links.length).toBeGreaterThanOrEqual(1);
    });

    it("يعرض شارة واحدة للثقة بدون حشو", () => {
      render(<LandingPage />);
      expect(screen.getAllByText("متاح مجانًا حاليًا").length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("مصمم بالعربي")).not.toBeInTheDocument();
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
      expect(screen.getByText("تعرف متى تعيد الطلب")).toBeInTheDocument();
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

  // ── Final CTA ─────────────────────────────────────────────────────────────

  describe("CTA النهائي", () => {
    it("يعرض عنوان 'ابدأ تتابع حساباتك اليوم'", () => {
      render(<LandingPage />);
      expect(
        screen.getByText("ابدأ تتابع حساباتك اليوم"),
      ).toBeInTheDocument();
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
      // ابدأ مجانًا (nav + hero + final)
      expect(ctaLinks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Preview (LedgerPreview) ───────────────────────────────────────────────

  describe("معاينة الدفتر (LedgerPreview)", () => {
    it("يعرض 'فواتير الشهر' ووسم البيانات التوضيحية", () => {
      render(<LandingPage />);
      expect(screen.getByText("فواتير الشهر")).toBeInTheDocument();
      expect(screen.getByText("بيانات توضيحية، لا تمثل حسابًا حقيقيًا")).toBeInTheDocument();
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
      for (const name of ["المزايا", "المتاح مجانًا", "الأسئلة الشائعة"]) {
        expect(within(panel).getByRole("link", { name })).toBeInTheDocument();
      }
    });

    it("صورة اللوحة التوضيحية مخفية عن قارئ الشاشة ومعلّمة كمثال", () => {
      render(<LandingPage />);
      const preview = screen.getByText("صافي ربح الشهر").closest("[aria-hidden='true']");
      expect(preview).not.toBeNull();
      expect(screen.getByText(/بيانات توضيحية، لا تمثل حسابًا حقيقيًا/)).toBeInTheDocument();
    });

    it("عبارة الثقة لا تعد بعدم مشاركة أي معلومة", () => {
      render(<LandingPage />);
      expect(screen.queryByText(/لا نبيع بيانات ولا نشارك أي معلومة/)).not.toBeInTheDocument();
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
      expect(screen.getAllByText(/غير مفعّلة بعد — لا يتم تحصيل أي مبلغ/).length).toBe(2);
    });
  });
});
