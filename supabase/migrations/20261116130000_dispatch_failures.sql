-- viper fleet: why a dispatch job failed (ADM-20). Idempotent.
--
-- failure_reason: one of a short list, so failures can be counted ("customer not there" vs
-- "wrong address") instead of read from free text. The driver sets it when marking a job as
-- failed, so the driver guard (20261115140000) lets drivers write it too.

begin;

alter table public.dispatch_jobs
  add column if not exists failure_reason text
    check (failure_reason is null or failure_reason in
      ('customer_absent', 'wrong_address', 'refused', 'no_access', 'damaged', 'other'));

create or replace function public.dispatch_driver_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  allowed text[] := array['status', 'notes', 'proof_name', 'proof_photo_path',
                          'proof_signature_path', 'started_at', 'arrived_at', 'completed_at',
                          'failure_reason'];
  changed text;
begin
  -- Only the driver's own writes: the database's functions (security definer, e.g. closing the
  -- tracking link when private mode starts) run as their owner and are not limited here.
  if current_user <> 'authenticated' or not public.is_driver_role() then
    return new;
  end if;
  for changed in
    select key from jsonb_each(to_jsonb(new))
     where to_jsonb(new) -> key is distinct from to_jsonb(old) -> key
  loop
    if not changed = any(allowed) then
      raise exception 'a driver cannot change %', changed using errcode = '42501';
    end if;
  end loop;
  if new.status is distinct from old.status and not (
       (old.status in ('planned', 'assigned') and new.status = 'en_route')
    or (old.status = 'en_route' and new.status in ('arrived', 'done', 'failed'))
    or (old.status = 'arrived' and new.status in ('done', 'failed'))
  ) then
    raise exception 'a job cannot go from % to %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;

commit;
