-- viper fleet: a vehicle deleted in Traccar stays in the fleet database as archived (ADM-05).
-- Idempotent. Its work orders, documents, incidents and costs keep their vehicle; lists of live
-- vehicles come from Traccar, so an archived one simply no longer appears there.

begin;

alter table public.vehicles add column if not exists archived_at timestamptz;

comment on column public.vehicles.archived_at is
  'Set when the Traccar device was deleted; the history stays (ADM-05).';

commit;
