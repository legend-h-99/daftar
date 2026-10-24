-- Align the dev/CI schema with production (supabase/migrations is the source of truth).

-- Business: Google/email owners have no phone.
ALTER TABLE "Business" ALTER COLUMN "ownerPhone" DROP NOT NULL;

-- User: production stores the Google subject as "googleId" and keeps no avatar.
DROP INDEX "User_googleSub_key";
ALTER TABLE "User" RENAME COLUMN "googleSub" TO "googleId";
ALTER TABLE "User" DROP COLUMN "avatarUrl";
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP NOT NULL;
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- Invoice: idempotent creation (see supabase/migrations/20261003090000, 20261003120000).
ALTER TABLE "Invoice" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "idempotencyHash" TEXT;
CREATE UNIQUE INDEX "Invoice_businessId_idempotencyKey_key" ON "Invoice"("businessId", "idempotencyKey");

-- InvoiceItem: stable line order.
ALTER TABLE "InvoiceItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "InvoiceItem_invoiceId_position_idx" ON "InvoiceItem"("invoiceId", "position");
