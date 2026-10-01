-- Keep the SECURITY DEFINER tenant lookup outside Supabase's exposed API schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_business_id()
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

REVOKE ALL ON FUNCTION private.current_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_business_id() TO authenticated;

DROP POLICY business_member_only ON public."Business";
CREATE POLICY business_member_only ON public."Business"
  FOR ALL TO authenticated
  USING (id = private.current_business_id())
  WITH CHECK (id = private.current_business_id());

DROP POLICY material_business_only ON public."Material";
CREATE POLICY material_business_only ON public."Material"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY supplier_business_only ON public."Supplier";
CREATE POLICY supplier_business_only ON public."Supplier"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY purchase_business_only ON public."Purchase";
CREATE POLICY purchase_business_only ON public."Purchase"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY stock_movement_business_only ON public."StockMovement";
CREATE POLICY stock_movement_business_only ON public."StockMovement"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY product_business_only ON public."Product";
CREATE POLICY product_business_only ON public."Product"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY customer_business_only ON public."Customer";
CREATE POLICY customer_business_only ON public."Customer"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY invoice_business_only ON public."Invoice";
CREATE POLICY invoice_business_only ON public."Invoice"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());
DROP POLICY expense_business_only ON public."Expense";
CREATE POLICY expense_business_only ON public."Expense"
  FOR ALL TO authenticated USING ("businessId" = private.current_business_id())
  WITH CHECK ("businessId" = private.current_business_id());

DROP POLICY purchase_item_business_only ON public."PurchaseItem";
CREATE POLICY purchase_item_business_only ON public."PurchaseItem"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Purchase" AS p
    WHERE p.id = "PurchaseItem"."purchaseId"
      AND p."businessId" = private.current_business_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Purchase" AS p
    WHERE p.id = "PurchaseItem"."purchaseId"
      AND p."businessId" = private.current_business_id()
  ));

DROP POLICY invoice_item_business_only ON public."InvoiceItem";
CREATE POLICY invoice_item_business_only ON public."InvoiceItem"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Invoice" AS i
    WHERE i.id = "InvoiceItem"."invoiceId"
      AND i."businessId" = private.current_business_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Invoice" AS i
    WHERE i.id = "InvoiceItem"."invoiceId"
      AND i."businessId" = private.current_business_id()
  ));

DROP POLICY recipe_item_business_only ON public."RecipeItem";
CREATE POLICY recipe_item_business_only ON public."RecipeItem"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Product" AS p
    WHERE p.id = "RecipeItem"."productId"
      AND p."businessId" = private.current_business_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Product" AS p
    WHERE p.id = "RecipeItem"."productId"
      AND p."businessId" = private.current_business_id()
  ));

DROP FUNCTION public.current_business_id();
