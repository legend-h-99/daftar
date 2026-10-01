-- The browser talks only to the API Edge Function. That function uses the
-- server-only service_role key and enforces the application's signed JWT and
-- business scope. Enable RLS so anon/authenticated clients cannot access
-- application tables directly if the public Supabase URL/key are discovered.
-- service_role intentionally retains access for the API and trusted migrations.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Business',
    'User',
    'EmailVerification',
    'PasswordReset',
    'OtpCode',
    'Material',
    'Supplier',
    'Purchase',
    'PurchaseItem',
    'StockMovement',
    'Product',
    'RecipeItem',
    'Customer',
    'Invoice',
    'InvoiceItem',
    'Expense',
    'TokenBlacklist'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END;
$$;
