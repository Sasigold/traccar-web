-- viper fleet: the safety inbox and its coaching loop (SAF-01). Idempotent.
--
-- A safety event from Traccar (overspeed, harsh driving, fatigue) is pending until someone
-- decides: coaching, praise or dismissed. A dismissed event leaves the driver's score. A minor
-- event can go to the driver for a 30-second self-review in the driver area; a severe one is
-- assigned to a named person. The driver reads only their own events sent for self-review and
-- answers only through safety_driver_ack().

begin;

create table if not exists public.safety_event_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  traccar_event_id bigint not null,
  traccar_device_id integer not null,
  driver_id uuid references public.drivers (id) on delete set null,
  category text not null,
  occurred_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'coaching', 'praise', 'dismissed')),
  severity text not null default 'minor' check (severity in ('minor', 'severe')),
  assigned_to uuid references public.profiles (id) on delete set null,
  self_review boolean not null default false,
  driver_answer text check (driver_answer in ('unavoidable', 'my_mistake', 'device_error', 'other')),
  driver_ack_at timestamptz,
  coached_at timestamptz,
  note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, traccar_event_id)
);

create index if not exists safety_event_reviews_driver_idx
  on public.safety_event_reviews (driver_id, occurred_at desc);

alter table public.safety_event_reviews enable row level security;

drop policy if exists safety_event_reviews_select on public.safety_event_reviews;
create policy safety_event_reviews_select on public.safety_event_reviews for select
  using (org_id = public.current_org_id()
         and (public.has_permission('safety.read')
              or (self_review and driver_id = public.my_driver_id())));

drop policy if exists safety_event_reviews_write on public.safety_event_reviews;
create policy safety_event_reviews_write on public.safety_event_reviews for all
  using (org_id = public.current_org_id() and public.has_permission('safety.write'))
  with check (org_id = public.current_org_id() and public.has_permission('safety.write'));

grant select, insert, update, delete on public.safety_event_reviews to authenticated;

drop trigger if exists safety_event_reviews_audit on public.safety_event_reviews;
create trigger safety_event_reviews_audit after insert or update or delete
  on public.safety_event_reviews for each row execute function public.audit_row();

-- The driver's answer to a self-review: their own event, sent to them, answered once.
create or replace function public.safety_driver_ack(p_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public.my_driver_id();
begin
  if v_driver is null then
    raise exception 'not a driver' using errcode = '42501';
  end if;
  if p_answer not in ('unavoidable', 'my_mistake', 'device_error', 'other') then
    raise exception 'unknown answer' using errcode = '22023';
  end if;
  update public.safety_event_reviews
     set driver_answer = p_answer, driver_ack_at = now()
   where id = p_id and driver_id = v_driver and self_review
     and org_id = public.current_org_id() and driver_ack_at is null;
  if not found then
    raise exception 'not your event, or already answered' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.safety_driver_ack(uuid, text) from public, anon;
grant execute on function public.safety_driver_ack(uuid, text) to authenticated;

commit;
