-- Optional Daftar-side read-only aggregate connector. Review and deploy separately.
-- Does not create the operations database or modify accounting records.
CREATE OR REPLACE FUNCTION public.operations_metrics(excluded_user_ids text[] DEFAULT '{}')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH eligible_users AS (
  SELECT u.id,u."businessId" FROM "User" u
  WHERE NOT (u.id=ANY(excluded_user_ids))
    AND coalesce(u.phone,'') !~ '^\+9665000000[0-9]+$'
    AND NOT EXISTS (SELECT 1 FROM "Business" b WHERE b.id=u."businessId" AND b."ownerPhone" ~ '^\+9665000000[0-9]+$')
 ), eligible_businesses AS (SELECT DISTINCT "businessId" AS id FROM eligible_users WHERE "businessId" IS NOT NULL),
 activity AS (
  SELECT "businessId" FROM "Invoice" WHERE "createdAt">=now() AT TIME ZONE 'utc'-interval '7 days'
  UNION SELECT "businessId" FROM "Expense" WHERE "createdAt">=now() AT TIME ZONE 'utc'-interval '7 days'
  UNION SELECT "businessId" FROM "Purchase" WHERE "createdAt">=now() AT TIME ZONE 'utc'-interval '7 days'
 )
 SELECT jsonb_build_object(
  'users',(SELECT count(*) FROM eligible_users),
  'businesses',(SELECT count(*) FROM eligible_businesses),
  'onboardedUsers',(SELECT count(*) FROM eligible_users WHERE "businessId" IS NOT NULL),
  'activeBusinesses7d',(SELECT count(*) FROM activity a JOIN eligible_businesses b ON b.id=a."businessId"),
  'invoices7d',(SELECT count(*) FROM "Invoice" i JOIN eligible_businesses b ON b.id=i."businessId" WHERE i."createdAt">=now() AT TIME ZONE 'utc'-interval '7 days'),
  'errors24h',(SELECT count(*) FROM "ApiErrorEvent" WHERE "createdAt">=now()-interval '24 hours')
 );
$$;
REVOKE ALL ON FUNCTION public.operations_metrics(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operations_metrics(text[]) TO service_role;
