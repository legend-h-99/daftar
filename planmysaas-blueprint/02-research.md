# Market research — دفتر

## Competitors (7)

### 1. قيود (Qoyod)
- **Category:** Direct (accounting SaaS, Saudi market)
- **Description:** Full-featured Arabic accounting platform with ZATCA e-invoicing compliance. Targets SMEs, restaurants, retail chains.
- **Strengths:** ZATCA-certified, multi-user, inventory management, payroll.
- **Weaknesses:** Complex onboarding, requires accounting literacy, minimum 79 SAR/month, no Arabic-first mobile UX.
- **Opportunity score: 7/10** — Strong gap: same geography, entirely wrong persona.

### 2. الأستاذ (Al-Ustad)
- **Category:** Direct (small shop accounting)
- **Description:** POS + simple accounting for small physical shops. 39 SAR/month.
- **Strengths:** Arabic UI, price-competitive, invoicing included.
- **Weaknesses:** Web-first (not mobile-first), requires a physical shop context, accounting terminology throughout, no recipe/COGS calculator.
- **Opportunity score: 6/10** — Adjacent persona, but shop owners ≠ home sellers.

### 3. Wafeq
- **Category:** Direct (cloud accounting, Saudi + UAE)
- **Description:** ZATCA-compliant cloud accounting. English-primary UI, bilingual. Targets startups and registered SMEs.
- **Strengths:** ZATCA, multi-currency, API integrations, investor-backed.
- **Weaknesses:** English-first mental model, requires VAT registration, pricing starts at 149 SAR/month, no mobile-first flow.
- **Opportunity score: 5/10** — Different customer entirely; useful as a future migration destination for grown-up دفتر users.

### 4. دفترة (Daftera)
- **Category:** Direct (ERP for SME, Saudi + Egypt)
- **Description:** Cloud ERP targeting retail and service companies with 5-50 employees.
- **Strengths:** Inventory, HR, payroll, POS, multi-branch.
- **Weaknesses:** Enterprise complexity, 200+ SAR/month starting, requires IT setup, no mobile-first usage.
- **Opportunity score: 4/10** — Different league; zero overlap with Beachhead.

### 5. Notion / Google Sheets
- **Category:** Substitute (DIY spreadsheet workaround)
- **Description:** General-purpose tools used by tech-literate sellers to track orders and costs manually.
- **Strengths:** Free, flexible, familiar to secondary persona (نورة).
- **Weaknesses:** No auto-calculation, no PDF invoice, no Arabic RTL layout, requires discipline to maintain.
- **Opportunity score: 9/10** — Converting Notion/Sheets users is the fastest path to initial users.

### 6. Paper notebook (دفتر ورقي)
- **Category:** Manual alternative
- **Description:** The most common tool for Beachhead persona. A physical notebook recording orders, names, amounts.
- **Strengths:** Zero friction to start, no device needed, culturally familiar.
- **Weaknesses:** No calculations, no summaries, gets lost, no reminders, cannot send invoices.
- **Opportunity score: 10/10** — Converting paper users is the core wedge. They have zero switching cost from an existing SaaS.

### 7. WhatsApp Business
- **Category:** Adjacent (order management channel)
- **Description:** Used by virtually all Beachhead users as their primary sales and communications tool. Catalog feature for product listings.
- **Strengths:** Universal adoption in Saudi, free, familiar.
- **Weaknesses:** No accounting, no profit calculation, no invoice generation, no payment tracking.
- **Opportunity score: 8/10** — Complementary, not competing. دفتر outputs (PDF invoices, WhatsApp reminders) feed back into this channel.

### Opportunity ranking

| Name | Type | Key weakness | Score |
|------|------|-------------|-------|
| Paper notebook | Manual alternative | No calculation, no reminders | 10 |
| Notion / Google Sheets | Substitute | No Arabic RTL, no automation | 9 |
| WhatsApp Business | Adjacent | No accounting layer at all | 8 |
| قيود | Direct | Wrong persona, wrong price point | 7 |
| الأستاذ | Direct | Web-first, shop context | 6 |
| Wafeq | Direct | English-first, VAT required | 5 |
| دفترة | Direct | ERP complexity, wrong scale | 4 |

---

## Problem clusters (top 5)

### 1. Invisible profitability
- **Frequency:** Universal across all three personas
- **Severity:** High
- **Phrasings:**
  - "أبيع كثير بس ما أعرف إذا كنت أربح"
  - "في نهاية الشهر ما أعرف وين راحت الفلوس"
  - "أظن أني أكسب بس لما أحسب ما يطلع معي شي"

### 2. Forgotten debtors
- **Frequency:** High — reported by 4 in 5 Beachhead users in qualitative research
- **Severity:** High
- **Phrasings:**
  - "عندي زبونات ما دفعن من شهرين وأنا ناسية"
  - "أخجل أطالب الزبونة مرة ثانية"
  - "لو كان عندي تذكير تلقائي كان أسهل"

### 3. Inaccurate pricing
- **Frequency:** High for نورة, medium for أم الطيبين
- **Severity:** High
- **Phrasings:**
  - "أسعر بالحدس — أقول يبدو معقول"
  - "ناسية أحسب التغليف والوقت"
  - "ما أعرف إذا كان الكيلو بكرة سيغير ربحيتي"

### 4. Unprofessional image
- **Frequency:** Medium
- **Severity:** Medium (growing as Instagram commerce professionalizes)
- **Phrasings:**
  - "زبونتي تطلب فاتورة وأنا ما عندي إلا رسالة واتساب"
  - "أبي أبين محترفة مثل شركة حقيقية"
  - "الفاتورة PDF تزيد ثقة الزبونة"

### 5. Tool overwhelm
- **Frequency:** Medium — particularly when trying established software
- **Severity:** Medium (causes churn before habit forms)
- **Phrasings:**
  - "جربت قيود بس ما فهمت شي"
  - "الكلام اللي فيه كأنه محاسب يتكلم"
  - "ودي شي بسيط مثل دفتر الورق بس على الجوال"

---

## Market gaps (top 5)

1. **Arabic-native mental model for non-accountants.** All direct competitors use accounting terminology (ذمم مدينة، قيود محاسبية، ميزانية عمومية). No tool maps these to everyday Saudi Arabic phrases the Beachhead persona actually uses.

2. **Recipe-linked COGS calculator at micro-business scale.** Qoyod and دفترة have bill-of-materials features but they require multi-step configuration and are buried inside complex UIs. No tool surfaces a simple "ingredient → product → margin" flow optimized for home production.

3. **WhatsApp-native invoice delivery.** Every tool generates a PDF and stops. None pre-formats a WhatsApp message with the PDF attached and a customizable Arabic reminder text. The final mile of "sending to the customer" is entirely unaddressed.

4. **Offline-first mobile accounting.** Saudi data connectivity in kitchens, markets, and delivery routes is unreliable. No competitor prioritizes offline queue + sync as a core reliability promise.

5. **Progressive trust-building for the debt conversation.** Beachhead users psychologically avoid asking customers for overdue payment. No tool provides a "polite, non-confrontational WhatsApp reminder" template tuned to Saudi social norms that makes asking easier.

---

## Insights (top 5)

1. **The fear of knowing is the real product barrier — not the tool complexity.**
   Most Beachhead users cite fear of discovering they are losing money as a reason to avoid tracking. This means the first experience cannot show a net-loss dashboard. Onboarding must start with a single invoice success, not a financial overview. *Implies:* Activation flow must defer profit reporting until the user has at least 3 invoices.

2. **WhatsApp is not a competing channel — it is the distribution layer.**
   Every Beachhead user already uses WhatsApp for sales, customer follow-up, and payment reminders. دفتر outputs (PDF, reminder message) should be designed to flow into WhatsApp naturally. *Implies:* The Share Sheet integration for PDF delivery and the one-tap WhatsApp reminder are not features — they are the product's delivery mechanism.

3. **The paper notebook has zero switching cost — and zero retention cost.**
   Paper users are the easiest to acquire (no SaaS contract to break) but also the easiest to lose (reverting to paper is frictionless). Retention must come from the system working better than memory, not from lock-in. *Implies:* Push notifications for overdue invoices and monthly profit summaries are retention-critical, not nice-to-have.

4. **Saudi Vision 2030's freelance document (وثيقة العمل الحر) created a legal identity for this persona.**
   Home sellers now have an official business identity but no tools calibrated to it. This creates a regulatory tailwind and a potential B2B2C channel (social development bank, freelance platform operators). *Implies:* Position دفتر early as "the app for وثيقة حرة holders" — not just "home businesses." The regulatory identity provides messaging credibility.

5. **Willingness to pay is emotional, not rational.**
   In qualitative signals, Beachhead users say "29 SAR is nothing if it saves me from losing money." The unlock is not price; it is the *moment of first clarity* — seeing their real monthly profit for the first time. *Implies:* The free-to-paid conversion trigger should fire immediately after the first profit report, not after a time-based trial.

---

## Strategic direction

**Best wedge — بائعات الطعام المنزلي in Riyadh and Jeddah who currently use paper.**
These users have the highest pain density (profitability unknown + debt forgotten + no invoice), the fastest time-to-value (one invoice creates the first "aha"), and zero incumbent competition at their price point and mental model. Acquiring them costs nothing: WhatsApp cooking groups, Instagram food pages, and word-of-mouth referrals within family networks. The distribution is already assembled; دفتر just needs to be mentioned in the right groups.

**Initial positioning:**
> "دفتر — اعرفي ربحك الحقيقي في 10 ثواني. بدون محاسب، بدون مصطلحات."

This line works because it: (a) speaks directly to the Beachhead fear ("ربحك الحقيقي"), (b) names the speed that makes it feel safe to try ("10 ثواني"), and (c) removes the two biggest barriers immediately ("بدون محاسب، بدون مصطلحات").

**Core product promise (what a user would repeat to a friend):**
> "يحسب لي كم ربحت هذا الشهر وين وفين."

---

## Build first / Don't overbuild / Delay to later

| Build first | Don't overbuild | Delay to later |
|-------------|-----------------|----------------|
| Invoice creation + Arabic PDF | ZATCA compliance (pre-PMF) | Native iOS/Android app |
| "لي عند" debt tracker | Multi-user / team permissions | WhatsApp Business API |
| Expense logging (5 categories) | Advanced analytics dashboard | AI-powered price recommendations |
| Recipe → COGS calculator | ERP-style reporting | Multi-currency support |
| Monthly profit summary | Bulk import / data migration | B2B bank partnership portal |
| Offline queue + sync | Custom invoice templates | Subscription billing engine |
