
-- ═══════════════════════════════════════════════════════
-- 1. Drop duplicate (older) RLS policies — keep the newer Business_* ones
-- ═══════════════════════════════════════════════════════

-- Business
DROP POLICY IF EXISTS business_delete_own ON public."Business";
DROP POLICY IF EXISTS business_insert_own ON public."Business";
DROP POLICY IF EXISTS business_select_own ON public."Business";
DROP POLICY IF EXISTS business_update_own ON public."Business";

-- User
DROP POLICY IF EXISTS user_delete_own_business ON public."User";
DROP POLICY IF EXISTS user_insert_own_business ON public."User";
DROP POLICY IF EXISTS user_select_own_business ON public."User";
DROP POLICY IF EXISTS user_update_own_business ON public."User";

-- Customer — keep Customer_all_same_business (ALL), drop granular duplicates
DROP POLICY IF EXISTS customer_delete_own ON public."Customer";
DROP POLICY IF EXISTS customer_insert_own ON public."Customer";
DROP POLICY IF EXISTS customer_select_own ON public."Customer";
DROP POLICY IF EXISTS customer_update_own ON public."Customer";

-- Invoice — keep Invoice_all_same_business (ALL), drop granular duplicates
DROP POLICY IF EXISTS invoice_delete_own ON public."Invoice";
DROP POLICY IF EXISTS invoice_insert_own ON public."Invoice";
DROP POLICY IF EXISTS invoice_select_own ON public."Invoice";
DROP POLICY IF EXISTS invoice_update_own ON public."Invoice";

-- ═══════════════════════════════════════════════════════
-- 2. Fix current_business_id() — switch to SECURITY INVOKER
--    (safe: the function only reads public.User which the caller already has access to)
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.current_business_id()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
AS $$
  SELECT u."businessId"
  FROM public."User" u
  WHERE u.id = (SELECT auth.uid())::text
  LIMIT 1;
$$;

-- Revoke direct RPC access from anonymous/authenticated roles
-- (this helper is only meant for RLS policy internals, not external calls)
REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO service_role;
