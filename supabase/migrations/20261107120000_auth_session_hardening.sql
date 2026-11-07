begin;

alter table public."User"
  add column if not exists "sessionVersion" integer not null default 0;

alter table public."User"
  drop constraint if exists user_session_version_nonnegative;
alter table public."User"
  add constraint user_session_version_nonnegative check ("sessionVersion" >= 0);

-- Links keep the raw token in the email, but the database stores only its hash.
-- Existing pending links are converted once so they remain usable after release.
create extension if not exists pgcrypto with schema extensions;
update public."EmailVerification"
set token = encode(extensions.digest(token, 'sha256'), 'hex')
where consumed = false;
update public."PasswordReset"
set token = encode(extensions.digest(token, 'sha256'), 'hex')
where consumed = false;

create or replace function public.reset_password_and_revoke_sessions(
  p_token_hash text,
  p_password_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reset_user_id text;
  account public."User"%rowtype;
begin
  update public."PasswordReset"
  set consumed = true
  where token = p_token_hash
    and consumed = false
    and "expiresAt" > clock_timestamp()
  returning "userId" into reset_user_id;

  if reset_user_id is null then
    return null;
  end if;

  update public."User"
  set "passwordHash" = p_password_hash,
      "emailVerified" = true,
      "sessionVersion" = "sessionVersion" + 1
  where id = reset_user_id
  returning * into account;

  if not found then
    raise exception 'Reset account not found';
  end if;

  return jsonb_build_object(
    'id', account.id,
    'email', account.email,
    'phone', account.phone,
    'name', account.name,
    'businessId', account."businessId",
    'sessionVersion', account."sessionVersion"
  );
end
$$;

revoke all on function public.reset_password_and_revoke_sessions(text, text)
  from public, anon, authenticated;
grant execute on function public.reset_password_and_revoke_sessions(text, text)
  to service_role;

-- The payment journal is append-only through its invoice trigger.
revoke insert, update, delete, truncate on public."InvoicePayment" from service_role;
create index if not exists "InvoicePayment_invoiceId_idx"
  on public."InvoicePayment" ("invoiceId");

commit;
