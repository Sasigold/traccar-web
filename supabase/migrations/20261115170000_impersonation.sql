-- viper fleet: "log in as" another user is recorded (SEC-13). Idempotent.
--
-- The app asks for a reason and records the start and the end in the audit log, with who did it.
-- Every audit row written while impersonating carries impersonated_by, read from the fleet JWT
-- claim of that name (the traccar-auth function adds it when the Traccar session was switched).

begin;

alter table public.audit_log add column if not exists impersonated_by text;

create or replace function public.audit_log_impersonation()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if new.impersonated_by is null and claims ? 'impersonated_by' then
    new.impersonated_by := claims ->> 'impersonated_by';
  end if;
  return new;
end;
$$;

drop trigger if exists audit_log_impersonation on public.audit_log;
create trigger audit_log_impersonation before insert on public.audit_log
  for each row execute function public.audit_log_impersonation();

-- p_event: 'start' (by the one who switches, before the switch) or 'end' (by the session that
-- was switched to, when it goes back).
create or replace function public.record_impersonation(
  p_event text, p_target_user integer, p_target_name text, p_by_name text, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_event not in ('start', 'end') then
    raise exception 'unknown event' using errcode = '22023';
  end if;
  if p_event = 'start' and length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'a reason is needed' using errcode = '22023';
  end if;
  insert into public.audit_log (org_id, user_id, action, table_name, row_id, new_data)
  values (public.current_org_id(), auth.uid(), 'impersonate_' || p_event, 'traccar_users',
          p_target_user::text,
          jsonb_build_object('target', left(p_target_name, 200), 'by', left(p_by_name, 200),
                             'reason', left(p_reason, 500)));
end;
$$;

revoke all on function public.record_impersonation(text, integer, text, text, text) from public, anon;
grant execute on function public.record_impersonation(text, integer, text, text, text) to authenticated;

commit;
