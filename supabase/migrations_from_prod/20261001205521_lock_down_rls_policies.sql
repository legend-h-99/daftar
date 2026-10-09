-- Rebuild RLS from a fail-closed baseline so the tenant rules are versioned,
-- reproducible, and cannot be weakened by a leftover permissive policy.
CREATE OR REPLACE FUNCTION public.current_business_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT u."businessId"
  FROM public."User" AS u
  WHERE u.id = (SELECT auth.uid())::text
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated;

DO $$
DECLARE
  policy_row record;
BEGIN
  -- Remove all prior policies on these tables before installing the explicit
  -- tenant-scoped rules below. PostgreSQL combines permissive policies with OR.
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'Business', 'User', 'Material', 'Supplier', 'Purchase', 'PurchaseItem',
        'StockMovement', 'Product', 'RecipeItem', 'Customer', 'Invoice',
        'InvoiceItem', 'Expense', 'EmailVerification', 'PasswordReset',
        'OtpCode', 'TokenBlacklist', 'AuthRateLimit', 'ExternalUsageBudget'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', policy_row.policyname,
      policy_row.schemaname, policy_row.tablename);
  END LOOP;
END;
$$;

-- Every row carrying businessId can only be read or changed by a member of
-- that business. WITH CHECK prevents moving records into another tenant.
CREATE POLICY business_member_only ON public."Business"
  FOR ALL TO authenticated
  USING (id = public.current_business_id())
  WITH CHECK (id = public.current_business_id());

CREATE POLICY material_business_only ON public."Material"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY supplier_business_only ON public."Supplier"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY purchase_business_only ON public."Purchase"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY stock_movement_business_only ON public."StockMovement"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY product_business_only ON public."Product"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY customer_business_only ON public."Customer"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY invoice_business_only ON public."Invoice"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());
CREATE POLICY expense_business_only ON public."Expense"
  FOR ALL TO authenticated
  USING ("businessId" = public.current_business_id())
  WITH CHECK ("businessId" = public.current_business_id());

CREATE POLICY purchase_item_business_only ON public."PurchaseItem"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Purchase" AS p
    WHERE p.id = "PurchaseItem"."purchaseId"
      AND p."businessId" = public.current_business_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Purchase" AS p
    WHERE p.id = "PurchaseItem"."purchaseId"
      AND p."businessId" = public.current_business_id()
  ));

CREATE POLICY invoice_item_business_only ON public."InvoiceItem"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Invoice" AS i
    WHERE i.id = "InvoiceItem"."invoiceId"
      AND i."businessId" = public.current_business_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Invoice" AS i
    WHERE i.id = "InvoiceItem"."invoiceId"
      AND i."businessId" = public.current_business_id()
  ));

CREATE POLICY recipe_item_business_only ON public."RecipeItem"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Product" AS p
    WHERE p.id = "RecipeItem"."productId"
      AND p."businessId" = public.current_business_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Product" AS p
    WHERE p.id = "RecipeItem"."productId"
      AND p."businessId" = public.current_business_id()
  ));

-- The application authenticates through its API. Keep account credentials,
-- reset/verification tokens, OTPs, revocation data, and quotas API-only.
CREATE POLICY user_no_client_access ON public."User"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY email_verification_no_client_access ON public."EmailVerification"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY password_reset_no_client_access ON public."PasswordReset"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY otp_no_client_access ON public."OtpCode"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY token_blacklist_no_client_access ON public."TokenBlacklist"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY auth_rate_limit_no_client_access ON public."AuthRateLimit"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
CREATE POLICY external_usage_budget_no_client_access ON public."ExternalUsageBudget"
  FOR ALL TO PUBLIC USING (false) WITH CHECK (false);
