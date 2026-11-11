-- viper fleet: SIM inventory for the service (BIZ-05). Idempotent.
--
-- One row per SIM card: its ICCID, phone number, carrier and state (in stock, active, suspended,
-- cancelled), and the device it sits in. Imported in bulk from the carrier's list; linking a SIM
-- to a device marks it active. Platform data, like device_registry: read with customers.read,
-- written with customers.manage.

begin;

create table if not exists public.sim_cards (
  iccid text primary key check (iccid ~ '^[0-9]{18,22}F?$'),
  msisdn text check (msisdn is null or msisdn ~ '^\+?[0-9]{7,15}$'),
  carrier text,
  status text not null default 'stock' check (status in ('stock', 'active', 'suspended', 'cancelled')),
  traccar_device_id integer unique,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sim_cards enable row level security;

drop policy if exists sim_cards_read on public.sim_cards;
create policy sim_cards_read on public.sim_cards for select to authenticated
  using ((select public.has_permission('customers.read'))
         or (select public.has_permission('customers.manage')));

drop policy if exists sim_cards_write on public.sim_cards;
create policy sim_cards_write on public.sim_cards for all to authenticated
  using ((select public.has_permission('customers.manage')))
  with check ((select public.has_permission('customers.manage')));

grant select, insert, update, delete on public.sim_cards to authenticated;

-- A SIM put in a device is active; taken out, back in stock (unless suspended or cancelled).
create or replace function public.sim_cards_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if new.traccar_device_id is not null and new.status = 'stock' then
    new.status := 'active';
  elsif new.traccar_device_id is null and new.status = 'active' then
    new.status := 'stock';
  end if;
  return new;
end;
$$;

drop trigger if exists sim_cards_touch on public.sim_cards;
create trigger sim_cards_touch before insert or update on public.sim_cards
  for each row execute function public.sim_cards_touch();

drop trigger if exists sim_cards_audit on public.sim_cards;
create trigger sim_cards_audit after insert or update or delete on public.sim_cards
  for each row execute function public.audit_row();

commit;
