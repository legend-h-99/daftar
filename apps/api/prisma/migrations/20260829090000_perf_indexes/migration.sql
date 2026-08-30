-- Performance index additions (2026-08-29)
--
-- 1. OtpCode: replace single-column phone index with a composite that covers
--    the hot verifyOtp query: WHERE phone = ? AND consumed = false AND expiresAt > NOW()
-- 2. PurchaseItem: add purchaseId index (FK lookup on every Purchase include: items)
--                  add materialId index (FK lookup on Material include: purchaseItems)
-- 3. InvoiceItem: add invoiceId index (FK lookup on every Invoice include: items)
-- 4. StockMovement: add (businessId, type, createdAt) for the dashboard SALE-type filter

-- 1. OtpCode
DROP INDEX IF EXISTS "OtpCode_phone_idx";
CREATE INDEX "OtpCode_phone_consumed_expiresAt_idx"
  ON "OtpCode" ("phone", "consumed", "expiresAt");

-- 2. PurchaseItem
CREATE INDEX "PurchaseItem_purchaseId_idx"
  ON "PurchaseItem" ("purchaseId");

CREATE INDEX "PurchaseItem_materialId_idx"
  ON "PurchaseItem" ("materialId");

-- 3. InvoiceItem
CREATE INDEX "InvoiceItem_invoiceId_idx"
  ON "InvoiceItem" ("invoiceId");

-- 4. StockMovement
CREATE INDEX "StockMovement_businessId_type_createdAt_idx"
  ON "StockMovement" ("businessId", "type", "createdAt");
