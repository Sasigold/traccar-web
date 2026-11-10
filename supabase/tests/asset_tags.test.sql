-- OPS-08: a BLE tag belongs to one item per organization; report intervals are sane.
\set ON_ERROR_STOP 1
begin;

insert into public.organizations (id, name) values
  ('6a000000-0000-0000-0000-000000000000', 'Fleet A'),
  ('6b000000-0000-0000-0000-000000000000', 'Fleet B');

do $$ begin
  insert into public.vehicles (org_id, traccar_device_id, ble_tag, report_interval_hours)
  values ('6a000000-0000-0000-0000-000000000000', 601, 'AA:BB:CC:DD:EE:01', 24);
  begin
    insert into public.vehicles (org_id, traccar_device_id, ble_tag)
    values ('6a000000-0000-0000-0000-000000000000', 602, 'aa-bb-cc-dd-ee-01');
    assert false, 'the same tag, written differently, is still the same tag';
  exception when unique_violation then null;
  end;
  insert into public.vehicles (org_id, traccar_device_id, ble_tag)
  values ('6b000000-0000-0000-0000-000000000000', 603, 'AA:BB:CC:DD:EE:01');
  begin
    insert into public.vehicles (org_id, traccar_device_id, report_interval_hours)
    values ('6a000000-0000-0000-0000-000000000000', 604, 0);
    assert false, 'an interval is positive';
  exception when check_violation then null;
  end;
end $$;

rollback;
\echo 'asset_tags.test.sql: all assertions passed'
