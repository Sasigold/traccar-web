-- Ticket assignment to the driver (ISR-02): the new columns and their defaults.
\set ON_ERROR_STOP 1
begin;

insert into public.organizations (id, name) values ('a0000000-0000-0000-0000-0000000000a2', 'Tickets');
insert into public.driver_violations (org_id, occurred_at, received_at, due_at, fine_amount)
values ('a0000000-0000-0000-0000-0000000000a2', '2026-10-01 08:00+03', '2026-10-05', '2027-01-03', 250);

do $$ begin
  assert (select not charge_driver and charged_at is null from public.driver_violations
           where org_id = 'a0000000-0000-0000-0000-0000000000a2'), 'not charged to the driver by default';
  update public.driver_violations set charge_driver = true, charged_at = '2026-11-01'
   where org_id = 'a0000000-0000-0000-0000-0000000000a2';
  assert (select charged_at = '2026-11-01' from public.driver_violations
           where org_id = 'a0000000-0000-0000-0000-0000000000a2'), 'charge date kept';
end $$;

rollback;
