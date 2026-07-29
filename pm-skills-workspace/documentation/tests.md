# Tests — دفتر

## Existing Coverage

| Use Case | Rule | Expected Behavior | Evidence | CI Required |
|---|---|---|---|---|
| Auth service | OTP/JWT basics | request/verify works | `apps/api/src/auth/auth.service.spec.ts` | غير مؤكد |
| Dashboard | monthly metrics | dashboard calculations | `apps/api/src/dashboard/dashboard.service.spec.ts` | غير مؤكد |
| Invoices | invoice service | invoice behavior | `apps/api/src/invoices/invoices.service.spec.ts` | غير مؤكد |
| Web dashboard | UI calculation/render | dashboard test | `apps/web/__tests__/dashboard.test.tsx` | غير مؤكد |

## Proposed Tests

| Use Case | Rule | Expected Behavior | Test Type | Priority |
|---|---|---|---|---|
| OTP dev guard | `AUTH_DEV_OTP` forbidden outside dev/test | app refuses to start | automated unit | P0 |
| OTP attempts | code consumed after 5 failures | no brute force | automated unit | P0 |
| Tenant isolation | user cannot read other business invoices | 403/404/no data | integration | P0 |
| Invoice payment | partial payment updates status/remaining | correct paidAmount/status | unit/integration | P0 |
| Recipe cost | product total cost is correct | raw+packaging+overhead | unit | P0 |
| Stock ledger | sale/purchase adjusts balance | signed StockMovement | integration | P0 |
| Profit dashboard | net profit excludes/handles expenses | correct monthly result | unit | P0 |
| OCR review | OCR does not auto-save without confirmation | no purchase created | integration | P1 |
| PWA critical path | login -> invoice -> dashboard | works on mobile browser | manual E2E | P0 |

## Gaps

| Rule | Exposure | Risk | Recommended Test |
|---|---|---|---|
| No database RLS | tenant data | cross-business leakage | integration across every service |
| OTP provider absent | launch | users cannot log in | guarded live OTP test |
| PDF RTL quality | customer-facing | broken invoices | visual/manual PDF test |
| Privacy delete/export | PDPL | compliance gap | manual + API test |
| Backups | operations | data loss | restore drill |

