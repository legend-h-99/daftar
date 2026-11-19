-- SECURITY DEFINER functions in public take a business id from the caller and do not check who
-- calls them. Only the API may run them, through service_role after it verifies the session token.
-- This revokes the existing grants. Idempotent: safe to re-run. private.current_business_id is in
-- another schema and is not changed.
--
-- Limit: PostgreSQL gives PUBLIC EXECUTE on new functions, and ALTER DEFAULT PRIVILEGES does not
-- remove that. Every new SECURITY DEFINER function in public must revoke from public, anon and
-- authenticated in its own migration, the same way as the loop below.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
