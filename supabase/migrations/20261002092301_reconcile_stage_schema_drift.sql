-- Bring older preview branches up to the live application schema required by
-- the inventory and recipe transaction functions. This is safe for existing
-- rows and mirrors the production column types/nullability.
ALTER TABLE public."Material"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."Material" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE public."RecipeItem"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."RecipeItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE public."StockMovement"
  ADD COLUMN IF NOT EXISTS "costAmount" double precision;

ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP;
