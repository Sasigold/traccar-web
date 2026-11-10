-- ADM-22: who a driver calls. The dispatcher's name and phone are kept on the organization and
-- read by every member through org_contact() (a driver cannot read the other profiles). Set by
-- someone who manages users, through set_org_contact().

begin;

alter table public.organizations
  add column if not exists dispatch_name text,
  add column if not exists dispatch_phone text
    check (dispatch_phone is null or dispatch_phone ~ '^\+?[0-9]{7,15}$');

create or replace function public.org_contact()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object('name', o.dispatch_name, 'phone', o.dispatch_phone)
    from public.organizations o
   where o.id = public.current_org_id()
$$;

revoke all on function public.org_contact() from public, anon;
grant execute on function public.org_contact() to authenticated;

create or replace function public.set_org_contact(p_name text, p_phone text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.has_permission('users.manage') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.organizations
     set dispatch_name = nullif(btrim(p_name), ''),
         dispatch_phone = nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), '')
   where id = public.current_org_id();
end;
$$;

revoke all on function public.set_org_contact(text, text) from public, anon;
grant execute on function public.set_org_contact(text, text) to authenticated;

commit;
