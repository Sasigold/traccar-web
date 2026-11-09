-- viper fleet: traffic and parking tickets assigned to the driver (ISR-02). Idempotent.
--
-- A ticket for a company vehicle that is not assigned to the driver in time is charged to the
-- company, usually at four times the fine. The deadline runs from the day the notice was
-- received; charging the driver (payroll deduction or collection) is tracked separately.

begin;

alter table public.driver_violations
  add column if not exists received_at date,
  add column if not exists charge_driver boolean not null default false,
  add column if not exists charged_at date;

comment on column public.driver_violations.received_at is
  'When the notice arrived; the assignment deadline (due_at) is usually 90 days later.';
comment on column public.driver_violations.charge_driver is
  'The fine is charged to the driver (payroll deduction or collection); charged_at when done.';

commit;
