# دفتر (Daftar)

> Arabic-first mobile accounting app that tells Saudi home-based producers their real profit in 10 seconds — no accountant, no jargon.

## Problem statement

Over 2.25 million freelancers are registered on Saudi Arabia's national platform, and the vast majority run their micro-businesses through WhatsApp and paper notebooks. At month-end they cannot answer three basic questions: how much did I actually earn after costs, which customers haven't paid, and which product is worth continuing. Every existing accounting tool — Qoyod, Al-Ustad, Wafeq — was designed for registered companies with accountants, not for the mother selling home-cooked food from her kitchen. The gap is not a feature gap; it is a language and mental-model gap.

## Target audience

### Primary — أم الطيبين (Beachhead)
- **Who:** Married woman, 32–45, sells home-cooked food (kanafah, meals, sweets) via WhatsApp. 15–30 orders per week. Based in Riyadh or Jeddah.
- **Current tool:** Paper notebook or nothing.
- **Watering holes:** WhatsApp groups, Instagram food pages, family networks.
- **WTP:** 20–35 SAR/month once value is proven.
- **Hidden insight:** She sometimes avoids knowing her numbers because she fears discovering she is losing money.

### Secondary — نورة الحرفية
- **Who:** 22–34, sells handmade products (candles, soap, embroidery) via Instagram + WhatsApp.
- **Current tool:** Excel (gives the illusion of control, not actual control).
- **Pain:** Cannot calculate production cost accurately — forgets packaging and time.
- **WTP:** 29–49 SAR/month.

### Tertiary — خالد المستقل
- **Who:** 25–40, freelance services (design, tutoring, writing) with a freelance work permit.
- **Current tool:** WhatsApp + bank transfer, no invoices.
- **Pain:** Looks unprofessional; clients delay payment.
- **WTP:** 29–49 SAR/month.

## Business model

**Freemium → Monthly subscription.** MVP is 100% free to achieve Product-Market Fit. Phase 2 introduces a paid tier at 29–49 SAR/month after validating retention and willingness to pay with the first 50 active users. Free tier limits (invoice cap, export quota) are to be determined post-PMF via A/B test. No annual plan until 100 paying users.

## Key features (top 5)

1. **Invoice creation + Arabic PDF** — Core promise. Lets any user look professional and send a shareable receipt via WhatsApp Share Sheet. Solves core problem.
2. **"لي عند" debt tracker** — Shows outstanding balances sorted by oldest first. Pre-fills a polite WhatsApp reminder message. Solves core problem.
3. **Product cost calculator (وصفة)** — Links ingredients from inventory to a product recipe; auto-calculates COGS and margin. Solves core problem.
4. **Monthly profit report** — One number: revenue − expenses = net profit. Comparable to prior month. Retention driver.
5. **Expense logging** — Quick entry with five categories (raw materials, delivery, packaging, commissions, other). Retention driver.

## Founder's rules

1. **Mobile-only UX.** Every interaction must be completable on a 360px screen with one thumb. No desktop-first compromise.
2. **Zero accounting jargon.** "لي عند" not "ذمم مدينة". "ربحي" not "صافي الدخل". Every label is reviewed against the Beachhead persona before shipping.
3. **No compliance claims before formal verification.** No "ZATCA-compliant" or "Fatoora-certified" language until the regulatory process completes.

## Success criteria

- **Month 6:** 50 Weekly Active Users with D7 Retention ≥ 40% — proves the product creates a weekly habit.
- **Month 8:** 10 paying subscribers at 29 SAR/month — proves willingness to pay exists before scaling acquisition.

## Anti-goals

- ❌ Accounting for registered, VAT-liable companies (that is Qoyod's market).
- ❌ Multi-user / team features (single-owner business only in MVP and Phase 1).
- ❌ Native iOS / Android app (PWA covers the need; native deferred to Phase 3 if PWA retention proves out).
