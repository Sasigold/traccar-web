-- viper fleet: the public API, version 1 (INT-01). Idempotent.
--
-- The `public-api` edge function (supabase/functions/public-api) answers GET /v1/<resource> for
-- an API key. Everything that decides what a key may see happens here, in two functions that only
-- the service role may call:
--
--   api_authorize(key, scope)   the key's organization, its scope, and the rate limit: requests per
--                               minute and per day, counted per organization (the package's limit)
--   api_v1_rows(org, resource, since, limit, offset)
--                               one page of a resource, always filtered to the key's organization;
--                               the national ID, paths into storage and the customer's tracking
--                               link are left out
--
--   api_limits   the package's limits per organization; platform administrators set them, the
--                organization's integration managers read them
--   api_usage    requests per organization, key and minute (kept two days)
--
-- Version 1 is read-only: a "write" scope is accepted on keys but no endpoint writes yet.

begin;

create table if not exists public.api_limits (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  per_minute integer not null default 60 check (per_minute between 1 and 6000),
  per_day integer not null default 20000 check (per_day between 1 and 5000000),
  updated_at timestamptz not null default now()
);

comment on table public.api_limits is
  'Public API rate limits per organization (its package). Without a row: 60 a minute, 20,000 a day.';

create table if not exists public.api_usage (
  org_id uuid not null references public.organizations (id) on delete cascade,
  key_id uuid not null references public.api_keys (id) on delete cascade,
  minute timestamptz not null,
  count integer not null default 0,
  primary key (key_id, minute)
);

create index if not exists api_usage_org_idx on public.api_usage (org_id, minute desc);

alter table public.api_limits enable row level security;
alter table public.api_usage enable row level security;

drop policy if exists api_limits_read on public.api_limits;
create policy api_limits_read on public.api_limits for select to authenticated
  using ((org_id = public.current_org_id() and public.has_permission('integrations.manage'))
         or public.has_permission('customers.read'));

drop policy if exists api_limits_write on public.api_limits;
create policy api_limits_write on public.api_limits for all to authenticated
  using (public.has_permission('customers.manage'))
  with check (public.has_permission('customers.manage'));

drop policy if exists api_usage_read on public.api_usage;
create policy api_usage_read on public.api_usage for select to authenticated
  using (org_id = public.current_org_id() and public.has_permission('integrations.manage'));

revoke insert, update, delete on public.api_usage from authenticated, anon;
grant select on public.api_usage to authenticated;
grant select, insert, update, delete on public.api_limits to authenticated;

drop trigger if exists api_limits_audit on public.api_limits;
create trigger api_limits_audit after insert or delete or update
  on public.api_limits for each row execute function public.audit_row();

-- ─── authorize ───────────────────────────────────────────────────────────────

-- { status: 200 | 401 | 403 | 429, org_id, key_id, limit, remaining, reset, retry_after }.
-- Every valid request is counted, also those over the limit, so a client that ignores 429 stays
-- blocked until the window passes.
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
   where k.key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
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

-- ─── rows ────────────────────────────────────────────────────────────────────

-- The resources of version 1: the relation, the columns left out, the time that "changed since"
-- compares with, and a stable order for paging. Keep in step with
-- supabase/functions/public-api/resources.js (a unit test checks the names).
create or replace function public.api_v1_resource(p_name text)
returns table (relation text, hidden text[], changed text, ordering text)
language sql
immutable
as $$
  select r.relation, r.hidden, r.changed, r.ordering
    from (values
      ('vehicles', 'vehicles', array['org_id'], null, null),
      ('drivers', 'drivers', array['org_id', 'national_id'], null, null),
      ('assignments', 'vehicle_driver_assignments', array['org_id'], 'starts_at', null),
      ('documents', 'documents', array['org_id', 'storage_path'], null, null),
      ('work_orders', 'work_orders', array['org_id', 'invoice_path'], null, null),
      ('issues', 'issues', array['org_id', 'photos'], null, null),
      ('inspections', 'inspections', array['org_id', 'signature_path'], null, null),
      ('incidents', 'incidents', array['org_id'], null, null),
      ('fuel', 'fuel_transactions', array['org_id'], null, null),
      ('expenses', 'vehicle_expenses', array['org_id', 'receipt_path'], null, null),
      ('monthly_costs', 'vehicle_monthly_costs', array['org_id'], 'month',
        'month, vehicle_id, category'),
      ('violations', 'driver_violations', array['org_id', 'document_path'], null, null),
      ('dispatch_jobs', 'dispatch_jobs',
        array['org_id', 'proof_signature_path', 'proof_photo_path', 'tracking_link'], null, null)
    ) as r (name, relation, hidden, changed, ordering)
   where r.name = p_name;
$$;

-- One page of a resource for an organization: { data: [...], count } where every row also carries
-- `changed_at` (its last update, or its creation). `p_since` keeps rows changed at or after it.
create or replace function public.api_v1_rows(
  p_org uuid,
  p_resource text,
  p_since timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  spec record;
  v_changed text;
  v_result jsonb;
begin
  if p_org is null then
    raise exception 'organization required';
  end if;
  select * into spec from public.api_v1_resource(p_resource);
  if spec.relation is null then
    return null;
  end if;
  v_changed := case
    when spec.changed is not null then format('(to_jsonb(t)->>%L)::timestamptz', spec.changed)
    else '(coalesce(to_jsonb(t)->>''updated_at'', to_jsonb(t)->>''created_at''))::timestamptz'
  end;
  execute format(
    $q$
      select coalesce(jsonb_agg(page.row order by page.n), '[]'::jsonb)
        from (
          select (to_jsonb(t) - %1$L::text[]) || jsonb_build_object('changed_at', %2$s) as row,
                 row_number() over (order by %3$s) as n
            from public.%4$I t
           where t.org_id = $1 and ($2::timestamptz is null or %2$s >= $2)
           order by %3$s
           limit $3 offset $4
        ) page
    $q$,
    spec.hidden,
    v_changed,
    coalesce(spec.ordering, v_changed || ' nulls first, t.id'),
    spec.relation
  )
  using p_org, p_since, least(greatest(coalesce(p_limit, 100), 1), 1000), greatest(coalesce(p_offset, 0), 0)
  into v_result;
  return jsonb_build_object('data', v_result, 'count', jsonb_array_length(v_result));
end;
$$;

-- ─── housekeeping ────────────────────────────────────────────────────────────

create or replace function public.api_usage_cleanup()
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.api_usage where minute < now() - interval '2 days';
$$;

revoke all on function public.api_authorize(text, text) from public, anon, authenticated;
revoke all on function public.api_v1_rows(uuid, text, timestamptz, integer, integer)
  from public, anon, authenticated;
revoke all on function public.api_v1_resource(text) from public, anon, authenticated;
revoke all on function public.api_usage_cleanup() from public, anon, authenticated;
grant execute on function public.api_authorize(text, text) to service_role;
grant execute on function public.api_v1_rows(uuid, text, timestamptz, integer, integer) to service_role;
grant execute on function public.api_v1_resource(text) to service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'vf_api_usage_cleanup';
  perform cron.schedule('vf_api_usage_cleanup', '35 3 * * *', 'select public.api_usage_cleanup();');
end $$;

commit;
