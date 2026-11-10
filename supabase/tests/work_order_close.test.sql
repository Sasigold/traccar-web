-- ADM-19: closing an order resolves the faults it was opened for, and only those.
\set ON_ERROR_STOP 1
begin;

insert into public.organizations (id, name) values ('ca000000-0000-0000-0000-000000000000', 'Close A');
insert into public.vehicles (id, org_id, traccar_device_id)
values ('ca000000-0000-0000-0000-0000000000a1', 'ca000000-0000-0000-0000-000000000000', 1);
insert into public.work_orders (id, org_id, vehicle_id, title, status)
values ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-000000000000',
        'ca000000-0000-0000-0000-0000000000a1', 'Brakes', 'open');
insert into public.issues (id, org_id, vehicle_id, title, status, work_order_id) values
  ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-000000000000',
   'ca000000-0000-0000-0000-0000000000a1', 'Brake noise', 'in_progress',
   'ca000000-0000-0000-0000-0000000000b1'),
  ('ca000000-0000-0000-0000-0000000000c2', 'ca000000-0000-0000-0000-000000000000',
   'ca000000-0000-0000-0000-0000000000a1', 'Mirror', 'open', null);

do $$ begin
  assert (select prices_include_vat from public.work_orders) is true, 'prices include VAT by default';
end $$;

update public.work_orders set status = 'done', closed_at = now()
 where id = 'ca000000-0000-0000-0000-0000000000b1';

do $$ begin
  assert (select status from public.issues where id = 'ca000000-0000-0000-0000-0000000000c1')
    = 'resolved', 'the fault of the order is resolved with it';
  assert (select resolved_at from public.issues where id = 'ca000000-0000-0000-0000-0000000000c1')
    is not null, 'with a time';
  assert (select status from public.issues where id = 'ca000000-0000-0000-0000-0000000000c2')
    = 'open', 'another fault stays open';
end $$;

rollback;
