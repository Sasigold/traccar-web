-- One-transaction saves (ARC-05): a parent and its child rows are saved together or not at all,
-- and row security still decides.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

insert into public.organizations (id, name) values
  ('a7000000-0000-0000-0000-000000000000', 'Save A'),
  ('b7000000-0000-0000-0000-000000000000', 'Save B');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000007a1', 'a7000000-0000-0000-0000-000000000000', 'admin'),
  ('00000000-0000-0000-0000-0000000007a2', 'a7000000-0000-0000-0000-000000000000', 'viewer'),
  ('00000000-0000-0000-0000-0000000007b1', 'b7000000-0000-0000-0000-000000000000', 'admin');
insert into public.vehicles (id, org_id, traccar_device_id, plate_number) values
  ('e7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000000', 971, '71-111-11');

select pg_temp.as_user('00000000-0000-0000-0000-0000000007a1');
do $$
declare
  v_order uuid;
  v_incident uuid;
  v_claim uuid;
  v_template uuid;
begin
  -- A work order with two lines; empty fields, ids and links from the client are ignored.
  v_order := public.fleet_save('work_order', null,
    '{"org_id": "a7000000-0000-0000-0000-000000000000", "vehicle_id": "e7000000-0000-0000-0000-000000000001",
      "title": "טיפול", "type": "service", "status": "open", "total_cost": 999}',
    '[{"id": "x", "kind": "part", "description": "שמן", "quantity": 2, "unit_price": 50},
      {"kind": "labor", "description": "עבודה", "quantity": 1, "unit_price": 200, "work_order_id": "00000000-0000-0000-0000-000000000000"}]');
  assert (select count(*) from public.work_order_items where work_order_id = v_order) = 2, 'two lines';
  assert (select string_agg(description, ',' order by sort_order) from public.work_order_items
           where work_order_id = v_order) = 'שמן,עבודה', 'in order';
  assert (select total_cost from public.work_orders where id = v_order) = 300, 'the total follows the lines';

  -- Lines replaced; a bad line fails the whole save and nothing changes.
  perform public.fleet_save('work_order', v_order, '{"title": "טיפול 15,000"}',
    '[{"kind": "part", "description": "פילטר", "quantity": 1, "unit_price": 80}]');
  assert (select title from public.work_orders where id = v_order) = 'טיפול 15,000', 'updated';
  begin
    perform public.fleet_save('work_order', v_order, '{"title": "לא נשמר"}',
      '[{"kind": "part", "description": "x", "quantity": -1, "unit_price": 1}]');
    assert false, 'a negative quantity fails';
  exception when check_violation then null;
  end;
  assert (select title from public.work_orders where id = v_order) = 'טיפול 15,000', 'title unchanged';
  assert (select count(*) from public.work_order_items where work_order_id = v_order) = 1, 'lines unchanged';
  -- null children keeps the lines.
  perform public.fleet_save('work_order', v_order, '{"notes": "הערה"}', null);
  assert (select count(*) from public.work_order_items where work_order_id = v_order) = 1, 'lines kept';

  -- An incident with parties and a claim, then the claim updated.
  v_incident := public.fleet_save('incident', null,
    '{"org_id": "a7000000-0000-0000-0000-000000000000", "vehicle_id": "e7000000-0000-0000-0000-000000000001",
      "occurred_at": "2026-11-01T08:00:00Z", "type": "accident"}',
    '[{"role": "third_party", "name": "צד ג׳"}, {"role": "witness", "name": "עד"}]',
    '{"insurer": "הראל", "status": "draft"}');
  select id into v_claim from public.insurance_claims where incident_id = v_incident;
  assert v_claim is not null, 'claim inserted';
  perform public.fleet_save('incident', v_incident, '{"status": "claim"}', null,
    jsonb_build_object('id', v_claim, 'claim_number', 'C-7', 'incident_id', gen_random_uuid()));
  assert (select claim_number = 'C-7' and incident_id = v_incident from public.insurance_claims where id = v_claim),
    'claim updated, still on its incident';
  assert (select count(*) from public.incident_parties where incident_id = v_incident) = 2, 'parties';

  -- A checklist template with items.
  v_template := public.fleet_save('inspection_template', null,
    '{"org_id": "a7000000-0000-0000-0000-000000000000", "name": "בדיקת בוקר", "frequency": "daily"}',
    '[{"label": "צמיגים", "type": "pass_fail", "critical": true}]');
  assert (select count(*) from public.inspection_template_items where template_id = v_template) = 1, 'items';

  -- Only the tables fleet_save knows.
  begin
    perform public.fleet_save_insert('profiles', '{"role": "owner"}');
    assert false, 'not a generic writer';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.fleet_save('profiles', null, '{}');
    assert false, 'unknown kind';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- A viewer (no write permission) and another organization are refused by row security.
select pg_temp.as_user('00000000-0000-0000-0000-0000000007a2');
do $$ begin
  begin
    perform public.fleet_save('work_order', null,
      '{"org_id": "a7000000-0000-0000-0000-000000000000", "vehicle_id": "e7000000-0000-0000-0000-000000000001", "title": "x"}');
    assert false, 'a viewer cannot open work orders';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000007b1');
do $$ begin
  begin
    perform public.fleet_save('work_order', (select id from public.work_orders limit 1), '{"title": "x"}');
    assert false, 'another organization cannot change it';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
\echo 'fleet_save.test.sql: all assertions passed'
