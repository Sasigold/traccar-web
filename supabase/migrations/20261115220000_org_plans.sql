-- viper fleet: plans (BIZ-02). Idempotent.
--
-- Every organization has a plan: tracking (map, reports, alerts), fleet (+ validity, maintenance,
-- costs, safety, inspections, incidents, dispatch, POIs) or pro (+ AI, automations, the public
-- API and video). Existing organizations start on pro, so nothing that works today closes. A
-- trial opens the next plan until a date. Only a platform admin changes plans; the app reads its
-- own plan through org_plan() and shows "available in the … plan" instead of hiding an area.

begin;

alter table public.organizations
  add column if not exists plan text not null default 'pro'
    check (plan in ('tracking', 'fleet', 'pro')),
  add column if not exists plan_trial text check (plan_trial in ('fleet', 'pro')),
  add column if not exists plan_trial_until timestamptz;

-- An owner may rename the organization, but not change its own plan.
create or replace function public.organizations_plan_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user = 'authenticated'
     and (new.plan is distinct from old.plan
          or new.plan_trial is distinct from old.plan_trial
          or new.plan_trial_until is distinct from old.plan_trial_until) then
    raise exception 'only a platform admin changes plans' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_plan_guard on public.organizations;
create trigger organizations_plan_guard before update on public.organizations
  for each row execute function public.organizations_plan_guard();

create or replace function public.org_plan()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'plan', o.plan,
    'trial', case when o.plan_trial_until > now() then o.plan_trial end,
    'trial_until', case when o.plan_trial_until > now() then o.plan_trial_until end
  )
    from public.organizations o
   where o.id = public.current_org_id()
$$;

revoke all on function public.org_plan() from public, anon;
grant execute on function public.org_plan() to authenticated;

create or replace function public.set_org_plan(
  p_org uuid,
  p_plan text,
  p_trial text default null,
  p_trial_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'only a platform admin changes plans' using errcode = '42501';
  end if;
  update public.organizations
     set plan = p_plan, plan_trial = p_trial, plan_trial_until = p_trial_until
   where id = p_org;
  if not found then
    raise exception 'no such organization' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_org_plan(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.set_org_plan(uuid, text, text, timestamptz) to authenticated;

commit;
