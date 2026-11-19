-- Retention deletes ran inside read and ingest paths: admin_overview and product_analytics_summary
-- deleted old rows on every read, and record_product_event on every insert. Remove those statements
-- and run one scheduled job instead. Each replacement is checked, so the migration fails if a
-- function no longer contains the statement it expects. Runs in one transaction: on failure nothing
-- changes. Requires pg_cron on the project. Not re-runnable by design: after it applies, the
-- statements are gone, so a second run fails the check (the migration history prevents re-runs).
do $$
declare
  def text;
  stmt_errors constant text := 'delete from "ApiErrorEvent" where "createdAt" < now() - interval ''30 days'';';
  stmt_analytics constant text := 'DELETE FROM "ProductAnalyticsEvent" WHERE "createdAt" < now()-interval ''30 days'';';
begin
  def := pg_get_functiondef('public.admin_overview()'::regprocedure);
  if position(stmt_errors in def) = 0 then
    raise exception 'admin_overview: retention statement not found';
  end if;
  execute replace(def, stmt_errors, '');

  def := pg_get_functiondef('public.product_analytics_summary(integer)'::regprocedure);
  if position(stmt_analytics in def) = 0 then
    raise exception 'product_analytics_summary: retention statement not found';
  end if;
  execute replace(def, stmt_analytics, '');

  def := pg_get_functiondef('public.record_product_event(uuid,uuid,uuid,text,text,text,jsonb,timestamptz)'::regprocedure);
  if position(stmt_analytics in def) = 0 then
    raise exception 'record_product_event: retention statement not found';
  end if;
  execute replace(replace(def, stmt_analytics, ''),
    '-- Best-effort pruning runs on ingestion and when opening the admin summary.', '');
end $$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'daftar-retention-analytics-errors') then
    perform cron.unschedule('daftar-retention-analytics-errors');
  end if;
end $$;

select cron.schedule(
  'daftar-retention-analytics-errors',
  '17 3 * * *',
  $job$
    delete from public."ProductAnalyticsEvent" where "createdAt" < now() - interval '30 days';
    delete from public."ApiErrorEvent" where "createdAt" < now() - interval '30 days';
  $job$
);
