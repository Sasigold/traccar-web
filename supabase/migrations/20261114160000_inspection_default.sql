-- viper fleet: the driver's morning check always has a checklist (ADM-11). Idempotent.
--
-- Until a manager created a template, the driver's main action failed. Now, when the
-- organization has no active template, inspection_default_template() creates the daily one (the
-- same list as DEFAULT_CHECKLIST in src/common/fleet/inspections.js) and returns its id. Drivers
-- may call it (inspections.write) although they cannot manage templates.
--
-- A failed critical item opens an issue of severity "critical"; while such an issue is open the
-- vehicle is "not for driving" (vehicle_out_of_service).

begin;

create or replace function public.inspection_default_template()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_org_id();
  v_id uuid;
begin
  if v_org is null or not (public.has_permission('inspections.write')
                           or public.has_permission('inspections.manage')) then
    raise exception 'inspections.write is required' using errcode = '42501';
  end if;
  -- One at a time per organization.
  perform pg_advisory_xact_lock(hashtext('inspection_default_template:' || v_org));
  select id into v_id from public.inspection_templates
   where org_id = v_org and active order by created_at limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.inspection_templates (org_id, name, frequency, active)
  values (v_org, 'בדיקת בוקר', 'daily', true)
  returning id into v_id;
  insert into public.inspection_template_items (org_id, template_id, label, type, critical, sort_order)
  select v_org, v_id, item.label, item.type, item.critical, item.position
    from (values
      (0, 'צמיגים: לחץ אוויר ומצב', 'pass_fail', true),
      (1, 'בלמים ובלם יד', 'pass_fail', true),
      (2, 'אורות ראשיים, איתות ובלימה', 'pass_fail', true),
      (3, 'מראות', 'pass_fail', false),
      (4, 'מגבים ונוזל שמשות', 'pass_fail', false),
      (5, 'שמן מנוע ונוזל קירור', 'pass_fail', false),
      (6, 'צופר', 'pass_fail', false),
      (7, 'חגורות בטיחות', 'pass_fail', true),
      (8, 'מטף כיבוי אש', 'pass_fail', true),
      (9, 'ערכת עזרה ראשונה ומשולש אזהרה', 'pass_fail', false),
      (10, 'רישיון רכב ותעודת ביטוח ברכב', 'pass_fail', false),
      (11, 'נזק חיצוני חדש (תמונה)', 'photo', false)
    ) as item (position, label, type, critical);
  return v_id;
end;
$$;

-- Vehicles that must not be driven: an open critical issue.
create or replace view public.vehicle_out_of_service
with (security_invoker = true)
as
select i.org_id, i.vehicle_id, min(i.created_at) as since, string_agg(i.title, ', ') as reasons
  from public.issues i
 where i.severity = 'critical' and i.status in ('open', 'in_progress')
 group by i.org_id, i.vehicle_id;

revoke all on function public.inspection_default_template() from public, anon;
grant execute on function public.inspection_default_template() to authenticated;
grant select on public.vehicle_out_of_service to authenticated;

commit;
