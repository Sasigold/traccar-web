-- ISR-12: when the driving license was first issued, for the "new driver" tag (the first two
-- years). Synced from the driver card like the other license fields; the rules themselves live
-- in the app (src/common/fleet/newDriver.js).
alter table public.drivers add column if not exists license_issued date;

comment on column public.drivers.license_issued is
  'Date the driving license was first issued (ISR-12: new driver for the first two years).';
