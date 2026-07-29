# 05 Metrics And Analytics — دفتر

## Business Game

- [ ] Attention
- [x] Transaction
- [x] Productivity

دفتر يجمع بين Productivity Game لأن القيمة هي إنجاز الحسابات بسرعة، وTransaction Game لأن الفواتير والبيع والتحصيل أحداث جوهرية.

## North Star Metric

عدد الأسر/الأعمال الصغيرة جدًا التي تعرف ربحها الشهري عبر دفتر.

التعريف العملي: مستخدم/نشاط يفتح تقرير الربح الشهري مرة واحدة على الأقل خلال الشهر، ولديه بيانات مبيعات ومصاريف كافية لإظهار رقم صافي.

## Input Metrics

| Metric | Definition | Owner | Cadence | Why It Drives NSM |
|---|---|---|---|---|
| Activation | أول فاتورة خلال 24 ساعة | Product | يومي | بدون فاتورة لا توجد قيمة |
| First recipe completion | إكمال وصفة منتج واحدة | Product | أسبوعي | يحسن دقة الربح |
| Profit-view rate | فتح تقرير الربح شهريًا | Product/Growth | شهري | يقيس القيمة المباشرة |
| Debt reminder sent | إرسال تذكير "لي عند" | Product | أسبوعي | يزيد العودة والاستخدام |
| D7/D30 retention | عودة بعد 7/30 يومًا | Product | أسبوعي | يقيس عادة الحسابات |
| Free-to-paid CVR | تحويل للمدفوع | Business | شهري | يثبت الاستعداد للدفع |

## Targets

| Metric | MVP Target |
|---|---:|
| Activation | ≥ 60% |
| D7 Retention | ≥ 40% |
| D30 Retention | ≥ 25-40% |
| NPS | ≥ 50 |
| WAU | 50 في Q3 2026 |
| Paid subscriptions | 10 بعد تفعيل الدفع |

## Analytics Questions To SQL

| Business Question | Needed Tables | Grain | Filters | Output |
|---|---|---|---|---|
| كم مستخدمة أنشأت أول فاتورة خلال 24 ساعة؟ | User, Invoice | user | createdAt | activation rate |
| كم نشاط فتح تقرير الربح شهريًا؟ | events + Business | business-month | month | NSM |
| ما متوسط الفواتير لكل مستخدمة نشطة؟ | Invoice | business-week | issueDate | invoices/WAU |
| كم قيمة "لي عند" المتأخرة؟ | Invoice, Customer | invoice | status/dueDate | overdue total |
| أي منتجات هامشها منخفض؟ | Product | product | sellingPrice/cost | margin report |

## SQL Query Template

```sql
-- Activation: first invoice within 24h of first user creation.
select
  count(*) filter (
    where first_invoice_at <= user_created_at + interval '24 hours'
  )::float / nullif(count(*), 0) as activation_rate
from (
  select
    u.id,
    u."createdAt" as user_created_at,
    min(i."createdAt") as first_invoice_at
  from "User" u
  left join "Invoice" i on i."businessId" = u."businessId"
  group by u.id, u."createdAt"
) x;
```

## A/B Test Plan

| Experiment | Hypothesis | Primary Metric | Guardrails | Decision Rule |
|---|---|---|---|---|
| Hook: الربح vs الديون | الربح يجلب تسجيلًا أعلى | Signup CTR | Bounce | Ship if +20% |
| Onboarding: فاتورة أولًا vs وصفة أولًا | فاتورة أولًا أسرع | Activation | Recipe completion | Ship if activation improves |
| Free limit 10 vs 20 invoices | 10 يزيد paid CVR دون قتل usage | Paid click | D7 retention | Extend if mixed |

## Cohort Analysis Plan

| Cohort | Time Period | Retention Metric | Segment | Follow-up |
|---|---|---|---|---|
| أول 10 مستخدمات | Soft launch week | D1/D7 | طعام منزلي | مقابلات 15 دقيقة |
| مستخدمات أكملن وصفة | شهري | D30 | طعام/حرف | لماذا التزمن؟ |
| مستخدمات بلا وصفة | شهري | D7 churn | الجميع | أين الاحتكاك؟ |

