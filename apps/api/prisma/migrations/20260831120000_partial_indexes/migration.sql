-- Partial index: low-stock materials only (WHERE reorderLevel IS NOT NULL AND stockQty <= reorderLevel)
-- Covers the hot dashboard query without scanning all materials
CREATE INDEX IF NOT EXISTS "Material_low_stock_idx"
  ON "Material" ("businessId", "stockQty")
  WHERE "reorderLevel" IS NOT NULL;

-- Partial index: unpaid/partial invoices only
-- Covers the dashboard unpaid list + aggregate without date filter
CREATE INDEX IF NOT EXISTS "Invoice_unpaid_idx"
  ON "Invoice" ("businessId", "dueDate" ASC)
  WHERE status IN ('UNPAID', 'PARTIAL');

-- Partial index: active (unconsumed) OTP codes
-- The hot auth path only ever queries consumed=false
CREATE INDEX IF NOT EXISTS "OtpCode_active_idx"
  ON "OtpCode" ("phone", "expiresAt")
  WHERE consumed = false;

-- Partial index: unconsumed email verification tokens
CREATE INDEX IF NOT EXISTS "EmailVerification_active_idx"
  ON "EmailVerification" ("token", "expiresAt")
  WHERE consumed = false;

-- Partial index: non-expired token blacklist entries
-- Cleanup queries only need expired rows; auth checks only need live rows
CREATE INDEX IF NOT EXISTS "TokenBlacklist_live_idx"
  ON "TokenBlacklist" ("jti")
  WHERE "expiresAt" > NOW();

-- Covering index: Expense summary by month (avoids heap fetch for amount)
CREATE INDEX IF NOT EXISTS "Expense_month_covering_idx"
  ON "Expense" ("businessId", "date", "amount");

-- Covering index: Purchase summary by month
CREATE INDEX IF NOT EXISTS "Purchase_month_covering_idx"
  ON "Purchase" ("businessId", "date", "total");

-- Covering index: paid invoice totals by month
CREATE INDEX IF NOT EXISTS "Invoice_paid_month_idx"
  ON "Invoice" ("businessId", "status", "issueDate", "total")
  WHERE status = 'PAID';
