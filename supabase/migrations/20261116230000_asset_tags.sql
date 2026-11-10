-- viper fleet: equipment and trailers without a wired tracker (OPS-08). Idempotent.
--
-- ble_tag: the BLE tag on the item (a MAC address, iBeacon "uuid:major:minor" or Eddystone
-- "namespace:instance"); a vehicle tracker that sees it nearby reports it, and the app shows the
-- item where that vehicle is. report_interval_hours: how often the item's own battery tracker
-- reports (24 for once a day), so a quiet day is not an alarm.

begin;

alter table public.vehicles add column if not exists ble_tag text;
alter table public.vehicles add column if not exists report_interval_hours numeric;
alter table public.vehicles drop constraint if exists vehicles_ble_tag_check;
alter table public.vehicles add constraint vehicles_ble_tag_check
  check (ble_tag is null or length(trim(ble_tag)) between 4 and 80);
alter table public.vehicles drop constraint if exists vehicles_report_interval_check;
alter table public.vehicles add constraint vehicles_report_interval_check
  check (report_interval_hours is null or (report_interval_hours > 0 and report_interval_hours <= 720));

-- One item per tag in an organization.
create unique index if not exists vehicles_ble_tag_idx
  on public.vehicles (org_id, lower(regexp_replace(ble_tag, '[:\-\s]', '', 'g')))
  where ble_tag is not null;

commit;
