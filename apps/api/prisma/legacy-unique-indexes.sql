-- Legacy Docker image only (apps/api/Dockerfile). Prisma cannot model these
-- partial unique indexes, so `prisma db push` does not create them. They
-- match supabase/migrations_from_prod/20260822143114_add_google_auth_fields.sql.
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId") WHERE "googleId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;
