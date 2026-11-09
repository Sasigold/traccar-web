-- viper fleet: the platform administrators' view of the public API (INT-01). Idempotent.
--
-- Organizations are not readable across tenants, so the package limits are set from one function
-- that answers only platform administrators: every organization with its limits, its active keys
-- and its requests in the last 24 hours. The limits themselves are written to api_limits, whose
-- row security already allows only platform administrators.

begin;

create or replace function public.api_limits_overview()
returns table (
  org_id uuid,
  name text,
  per_minute integer,
  per_day integer,
  custom boolean,
  active_keys integer,
  used_day bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform administrators only' using errcode = '42501';
  end if;
  return query
    select o.id,
           o.name,
           coalesce(l.per_minute, 60),
           coalesce(l.per_day, 20000),
           l.org_id is not null,
           (select count(*)::integer from public.api_keys k
             where k.org_id = o.id and k.revoked_at is null
               and (k.expires_at is null or k.expires_at > now())),
           (select coalesce(sum(u.count), 0) from public.api_usage u
             where u.org_id = o.id and u.minute > now() - interval '1 day')
      from public.organizations o
      left join public.api_limits l on l.org_id = o.id
     order by o.name;
end;
$$;

revoke all on function public.api_limits_overview() from public, anon;
grant execute on function public.api_limits_overview() to authenticated;

commit;
