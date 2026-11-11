-- viper fleet: the driver sees their own safety score and can disagree with an event
-- (SAF-05, SEC-23). Idempotent.
--
-- * driver_my_periods(): the periods the signed-in driver had each vehicle (by Traccar id),
--   including vehicles they no longer have, so the driver portal attributes trips and events to
--   them and to nobody else.
-- * safety_driver_dispute(): "I disagree" on one event of their own (a period of theirs covers
--   it), once, with a reason. The event goes back to the safety inbox, marked as disputed.
-- * The driver reads the reviews of the events they disputed (and, as before, those sent to
--   them for a self-review), with the manager's answer.
-- * When the manager decides a disputed event, dismissing it accepts the dispute (the event
--   leaves the score) and any other decision rejects it.

begin;

alter table public.safety_event_reviews
  add column if not exists dispute_reason text,
  add column if not exists dispute_note text,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_result text,
  add column if not exists dispute_resolved_at timestamptz;

alter table public.safety_event_reviews drop constraint if exists safety_event_reviews_dispute_reason_check;
alter table public.safety_event_reviews add constraint safety_event_reviews_dispute_reason_check
  check (dispute_reason is null or dispute_reason in ('not_me', 'device_error', 'road_conditions', 'other'));
alter table public.safety_event_reviews drop constraint if exists safety_event_reviews_dispute_result_check;
alter table public.safety_event_reviews add constraint safety_event_reviews_dispute_result_check
  check (dispute_result is null or dispute_result in ('accepted', 'rejected'));
alter table public.safety_event_reviews drop constraint if exists safety_event_reviews_dispute_note_check;
alter table public.safety_event_reviews add constraint safety_event_reviews_dispute_note_check
  check (dispute_note is null or length(dispute_note) <= 500);

create index if not exists safety_event_reviews_disputed_idx
  on public.safety_event_reviews (org_id, disputed_at) where disputed_at is not null;

drop policy if exists safety_event_reviews_select on public.safety_event_reviews;
create policy safety_event_reviews_select on public.safety_event_reviews for select
  using (org_id = (select public.current_org_id())
         and ((select public.has_permission('safety.read'))
              or ((self_review or disputed_at is not null)
                  and driver_id = (select public.my_driver_id()))));

-- The manager's decision on a disputed event answers the dispute.
create or replace function public.safety_dispute_answer()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.disputed_at is not null and new.status is distinct from old.status then
    if new.status = 'pending' then
      new.dispute_result := null;
      new.dispute_resolved_at := null;
    else
      new.dispute_result := case when new.status = 'dismissed' then 'accepted' else 'rejected' end;
      new.dispute_resolved_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists safety_event_reviews_dispute on public.safety_event_reviews;
create trigger safety_event_reviews_dispute before update on public.safety_event_reviews
  for each row execute function public.safety_dispute_answer();

create or replace function public.driver_my_periods(p_from timestamptz default now() - interval '90 days')
returns table (traccar_device_id integer, plate_number text, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select v.traccar_device_id, v.plate_number, a.starts_at, a.ends_at
    from public.vehicle_driver_assignments a
    join public.vehicles v on v.id = a.vehicle_id
   where a.driver_id = public.my_driver_id()
     and a.org_id = public.current_org_id()
     and (a.ends_at is null or a.ends_at > p_from)
   order by a.starts_at;
$$;

revoke all on function public.driver_my_periods(timestamptz) from public, anon;
grant execute on function public.driver_my_periods(timestamptz) to authenticated;

create or replace function public.safety_driver_dispute(
  p_event bigint,
  p_device integer,
  p_category text,
  p_occurred_at timestamptz,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public.my_driver_id();
  v_org uuid := public.current_org_id();
  v_review public.safety_event_reviews;
begin
  if v_driver is null then
    raise exception 'not a driver' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('not_me', 'device_error', 'road_conditions', 'other') then
    raise exception 'unknown reason' using errcode = '22023';
  end if;
  if p_occurred_at > now() + interval '5 minutes' or p_occurred_at < now() - interval '90 days' then
    raise exception 'too old to dispute' using errcode = '22023';
  end if;
  -- Only an event in a period the driver had the vehicle.
  if not exists (
    select 1 from public.vehicle_driver_assignments a
      join public.vehicles v on v.id = a.vehicle_id
     where a.driver_id = v_driver and a.org_id = v_org and v.traccar_device_id = p_device
       and a.starts_at <= p_occurred_at and (a.ends_at is null or a.ends_at > p_occurred_at)
  ) then
    raise exception 'not your event' using errcode = '42501';
  end if;

  select * into v_review from public.safety_event_reviews
   where org_id = v_org and traccar_event_id = p_event;
  if v_review.id is not null then
    if v_review.traccar_device_id <> p_device
       or (v_review.driver_id is not null and v_review.driver_id <> v_driver) then
      raise exception 'not your event' using errcode = '42501';
    end if;
    if v_review.disputed_at is not null then
      raise exception 'already disputed' using errcode = '42501';
    end if;
    update public.safety_event_reviews
       set driver_id = v_driver, dispute_reason = p_reason, dispute_note = nullif(trim(p_note), ''),
           disputed_at = now(), status = 'pending', dispute_result = null, dispute_resolved_at = null
     where id = v_review.id;
  else
    insert into public.safety_event_reviews
      (org_id, traccar_event_id, traccar_device_id, driver_id, category, occurred_at,
       dispute_reason, dispute_note, disputed_at)
    values (v_org, p_event, p_device, v_driver, left(p_category, 40), p_occurred_at,
            p_reason, nullif(trim(p_note), ''), now());
  end if;
end;
$$;

revoke all on function public.safety_driver_dispute(bigint, integer, text, timestamptz, text, text) from public, anon;
grant execute on function public.safety_driver_dispute(bigint, integer, text, timestamptz, text, text) to authenticated;

commit;
