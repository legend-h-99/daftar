-- Platform admin overview and support links.
-- Additive: two service-only tables and two service-only functions.

create table if not exists "ApiErrorEvent" (
  id bigint generated always as identity primary key,
  method text not null,
  path text not null,          -- record ids replaced by ':id'; no personal data
  status integer not null,
  "createdAt" timestamptz not null default now()
);
create index if not exists "ApiErrorEvent_createdAt_idx" on "ApiErrorEvent" ("createdAt");

create table if not exists "AdminAuditLog" (
  id bigint generated always as identity primary key,
  "adminUserId" text not null,
  action text not null,
  "targetUserId" text,
  result text not null,
  "createdAt" timestamptz not null default now()
);
create index if not exists "AdminAuditLog_createdAt_idx" on "AdminAuditLog" ("createdAt");

-- Only the API (service_role) may touch these.
alter table "ApiErrorEvent" enable row level security;
alter table "AdminAuditLog" enable row level security;
revoke all on "ApiErrorEvent", "AdminAuditLog" from anon, authenticated;
grant all on "ApiErrorEvent", "AdminAuditLog" to service_role;

create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  -- Stored timestamps are naive UTC; Riyadh is UTC+3 all year.
  v_now timestamp := now() at time zone 'utc';
begin
  delete from "ApiErrorEvent" where "createdAt" < now() - interval '30 days';

  return jsonb_build_object(
    'users', (select count(*) from "User"),
    'businesses', (select count(*) from "Business"),
    'onboardedUsers', (select count(*) from "User" where "businessId" is not null),
    'googleUsers', (select count(*) from "User" where "googleId" is not null),
    'unverifiedEmailUsers', (select count(*) from "User" where "passwordHash" is not null and not coalesce("emailVerified", false)),
    'newUsers7d', (select count(*) from "User" where "createdAt" >= v_now - interval '7 days'),
    'newUsers30d', (select count(*) from "User" where "createdAt" >= v_now - interval '30 days'),
    'signupsByDay', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', coalesce(n, 0)) order by d), '[]'::jsonb)
      from generate_series(((v_now + interval '3 hours')::date - 13), (v_now + interval '3 hours')::date, interval '1 day') d
      left join (
        select ("createdAt" + interval '3 hours')::date as day, count(*) as n from "User"
        where "createdAt" >= v_now - interval '15 days' group by 1
      ) s on s.day = d::date),
    'activeBusinesses7d', (
      select count(distinct "businessId") from (
        select "businessId" from "Invoice" where "createdAt" >= v_now - interval '7 days'
        union all select "businessId" from "Expense" where "createdAt" >= v_now - interval '7 days'
        union all select "businessId" from "Purchase" where "createdAt" >= v_now - interval '7 days'
      ) activity),
    'invoices', (select count(*) from "Invoice"),
    'invoices7d', (select count(*) from "Invoice" where "createdAt" >= v_now - interval '7 days'),
    'errors24h', (select count(*) from "ApiErrorEvent" where "createdAt" >= now() - interval '24 hours'),
    'errorsByPath', (
      select coalesce(jsonb_agg(jsonb_build_object('method', method, 'path', path, 'status', status, 'count', n, 'lastAt', last_at)
        order by n desc), '[]'::jsonb)
      from (
        select method, path, status, count(*) as n, max("createdAt") as last_at from "ApiErrorEvent"
        where "createdAt" >= now() - interval '24 hours' group by 1, 2, 3 order by 4 desc limit 10
      ) e),
    'recentAdminActions', (
      select coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'result', a.result, 'targetEmail', u.email,
        'createdAt', a."createdAt") order by a."createdAt" desc), '[]'::jsonb)
      from (select * from "AdminAuditLog" order by "createdAt" desc limit 10) a
      left join "User" u on u.id = a."targetUserId")
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.admin_overview() to service_role;

-- Finds up to 20 users by email, name or shop name for the support page.
create or replace function public.admin_find_users(p_query text)
returns jsonb
language sql stable security definer set search_path to 'public'
as $$
  with q as (
    select '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', u.id, 'name', u.name, 'email', u.email, 'createdAt', u."createdAt",
      'emailVerified', coalesce(u."emailVerified", false), 'google', u."googleId" is not null,
      'hasPassword', u."passwordHash" is not null, 'businessName', b.name,
      'invoiceCount', (select count(*) from "Invoice" i where i."businessId" = u."businessId"),
      'lastInvoiceAt', (select max(i."createdAt") from "Invoice" i where i."businessId" = u."businessId")
    ) as row
    from "User" u left join "Business" b on b.id = u."businessId", q
    where u.email ilike q.pattern or u.name ilike q.pattern or b.name ilike q.pattern
    order by u."createdAt" desc
    limit 20
  ) found;
$$;

revoke all on function public.admin_find_users(text) from public, anon, authenticated;
grant execute on function public.admin_find_users(text) to service_role;
