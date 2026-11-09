-- viper fleet: the driver area can read what it fills in (ADM-09). Idempotent.
--
-- Drivers have inspections.write but not inspections.read, and the checklist templates were
-- readable only with inspections.read or inspections.manage, so a driver's morning check had no
-- template to fill. Whoever may fill in a check may read the templates.

begin;

do $$
declare
  name text;
begin
  foreach name in array array['inspection_templates', 'inspection_template_items'] loop
    execute format('drop policy if exists %I on public.%I', name || '_select', name);
    execute format(
      'create policy %I on public.%I for select using (org_id = public.current_org_id() and (public.has_permission(''inspections.read'') or public.has_permission(''inspections.manage'') or public.has_permission(''inspections.write'')))',
      name || '_select', name);
  end loop;
end $$;

commit;
