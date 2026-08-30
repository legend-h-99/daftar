-- Schema design fixes (2026-08-29)
--
-- 1. StockMovement.refType String? → StockRefType enum (type-safe, DB-enforced)
-- 2. Add updatedAt to Material, User, RecipeItem for change-tracking

-- 1a. Create the StockRefType enum
CREATE TYPE "StockRefType" AS ENUM ('PURCHASE', 'INVOICE');

-- 1b. Cast existing string values to the new enum; NULL stays NULL
ALTER TABLE "StockMovement"
  ALTER COLUMN "refType" TYPE "StockRefType"
    USING "refType"::"StockRefType";

-- 2a. Material.updatedAt — backfill with createdAt so existing rows are valid
ALTER TABLE "Material"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- 2b. User.updatedAt
ALTER TABLE "User"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- 2c. RecipeItem.updatedAt
ALTER TABLE "RecipeItem"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
