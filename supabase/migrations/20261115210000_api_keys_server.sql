-- viper fleet: API keys are made on the server (SEC-22). Idempotent.
--
-- create_api_key() makes the key from 20 random bytes (vf_ + 40 hex), stores only its HMAC with
-- a pepper kept in Vault (`api_key_pepper`; plain SHA-256 until the pepper is set), and returns
-- the key once. The browser can no longer insert keys of its own. Scopes are checked
-- (read, write), and a key expires after a year unless asked otherwise (at most two years).
-- Existing keys (plain SHA-256) keep working.

begin;

-- The stored form of a key.
create or replace function public.api_key_hash(p_key text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  pepper text;
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into pepper using 'api_key_pepper';
  end if;
  if pepper is null or pepper = '' then
    return encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
  end if;
  return 'h1:' || encode(hmac(convert_to(p_key, 'UTF8'), convert_to(pepper, 'UTF8'), 'sha256'), 'hex');
end;
$$;

revoke all on function public.api_key_hash(text) from public, anon, authenticated;
grant execute on function public.api_key_hash(text) to service_role;

-- The pepper, set once by the owner (like the other Vault secrets).
create or replace function public.api_key_set_pepper(p_pepper text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  existing uuid;
begin
  if length(coalesce(p_pepper, '')) < 32 then
    raise exception 'the pepper must be at least 32 characters' using errcode = '22023';
  end if;
  select id into existing from vault.secrets where name = 'api_key_pepper';
  if existing is null then
    perform vault.create_secret(p_pepper, 'api_key_pepper');
  else
    perform vault.update_secret(existing, p_pepper);
  end if;
end;
$$;

revoke all on function public.api_key_set_pepper(text) from public, anon, authenticated;
grant execute on function public.api_key_set_pepper(text) to service_role;

alter table public.api_keys drop constraint if exists api_keys_scopes_check;
alter table public.api_keys add constraint api_keys_scopes_check
  check (cardinality(scopes) > 0 and scopes <@ array['read', 'write']::text[]);
alter table public.api_keys alter column expires_at set default now() + interval '1 year';

-- Keys are made only here; the browser lists, renames and revokes them.
revoke insert on public.api_keys from authenticated;

create or replace function public.create_api_key(
  p_name text,
  p_scopes text[] default array['read'],
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_org_id();
  v_key text;
  v_expires timestamptz := coalesce(p_expires_at, now() + interval '1 year');
  v_id uuid;
begin
  if v_org is null or not public.has_permission('integrations.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'a name is required' using errcode = '22023';
  end if;
  if cardinality(p_scopes) = 0 or not (p_scopes <@ array['read', 'write']::text[]) then
    raise exception 'unknown scope' using errcode = '22023';
  end if;
  if v_expires <= now() or v_expires > now() + interval '2 years' then
    raise exception 'the expiry must be within two years' using errcode = '22023';
  end if;
  v_key := 'vf_' || encode(gen_random_bytes(20), 'hex');
  insert into public.api_keys (org_id, name, prefix, key_hash, scopes, expires_at, created_by)
  values (v_org, btrim(p_name), left(v_key, 8), public.api_key_hash(v_key), p_scopes, v_expires,
          auth.uid())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'key', v_key, 'expires_at', v_expires);
end;
$$;

revoke all on function public.create_api_key(text, text[], timestamptz) from public, anon;
grant execute on function public.create_api_key(text, text[], timestamptz) to authenticated;

-- The gateway accepts both stored forms.
create or replace function public.api_key_lookup(p_key text)
returns table (org_id uuid, scopes text[])
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  found public.api_keys;
begin
  select * into found from public.api_keys k
   where k.key_hash in (public.api_key_hash(p_key), encode(sha256(convert_to(p_key, 'UTF8')), 'hex'))
     and k.revoked_at is null and (k.expires_at is null or k.expires_at > now());
  if found.id is null then
    return;
  end if;
  update public.api_keys set last_used_at = now() where id = found.id;
  return query select found.org_id, found.scopes;
end;
$$;

revoke all on function public.api_key_lookup(text) from public, anon, authenticated;

create or replace function public.api_authorize(p_key text, p_scope text default 'read')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  found public.api_keys;
  v_limits public.api_limits;
  v_minute timestamptz := date_trunc('minute', now());
  v_reset bigint := extract(epoch from date_trunc('minute', now()) + interval '1 minute')::bigint;
  v_per_minute integer;
  v_per_day integer;
  v_used_minute integer;
  v_used_day integer;
begin
  if p_key is null or p_key !~ '^vf_[0-9a-f]{40}$' then
    return jsonb_build_object('status', 401);
  end if;
  select * into found from public.api_keys k
   where k.key_hash in (public.api_key_hash(p_key), encode(sha256(convert_to(p_key, 'UTF8')), 'hex'))
     and k.revoked_at is null and (k.expires_at is null or k.expires_at > now());
  if found.id is null then
    return jsonb_build_object('status', 401);
  end if;
  if not (coalesce(p_scope, 'read') = any (found.scopes)) then
    return jsonb_build_object('status', 403);
  end if;

  select * into v_limits from public.api_limits where org_id = found.org_id;
  v_per_minute := coalesce(v_limits.per_minute, 60);
  v_per_day := coalesce(v_limits.per_day, 20000);

  insert into public.api_usage as u (org_id, key_id, minute, count)
  values (found.org_id, found.id, v_minute, 1)
  on conflict (key_id, minute) do update set count = u.count + 1;

  select coalesce(sum(count) filter (where minute = v_minute), 0),
         coalesce(sum(count), 0)
    into v_used_minute, v_used_day
    from public.api_usage
   where org_id = found.org_id and minute > now() - interval '1 day';

  -- The last use, at most once a minute per key.
  update public.api_keys set last_used_at = now()
   where id = found.id and (last_used_at is null or last_used_at < now() - interval '1 minute');

  if v_used_day > v_per_day then
    return jsonb_build_object('status', 429, 'limit', v_per_day, 'remaining', 0,
      'reset', v_reset, 'retry_after', 3600, 'window', 'day');
  end if;
  if v_used_minute > v_per_minute then
    return jsonb_build_object('status', 429, 'limit', v_per_minute, 'remaining', 0,
      'reset', v_reset, 'retry_after', greatest(1, v_reset - extract(epoch from now())::bigint),
      'window', 'minute');
  end if;
  return jsonb_build_object('status', 200, 'org_id', found.org_id, 'key_id', found.id,
    'limit', v_per_minute, 'remaining', v_per_minute - v_used_minute, 'reset', v_reset);
end;
$$;

revoke all on function public.api_authorize(text, text) from public, anon, authenticated;
grant execute on function public.api_authorize(text, text) to service_role;

commit;
