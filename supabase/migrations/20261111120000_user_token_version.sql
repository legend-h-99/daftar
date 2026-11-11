-- Per-account token version. A password change assigns a new value, and the Edge function rejects
-- tokens issued with an older one. Existing rows default to 0, which matches tokens issued before
-- this migration (they carry no claim, which counts as 0), so no session ends at deploy time.
-- Apply this migration before deploying the Edge function that selects the column.
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0;
