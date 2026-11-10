-- viper fleet: an automation for trips on Shabbat and holidays (ISR-09). Idempotent.
--
-- The rule is worked out in the app (from candle lighting to nightfall, by the Hebrew calendar);
-- the database only has to accept the new template name.

begin;

alter table public.automation_rules drop constraint if exists automation_rules_template_check;
alter table public.automation_rules add constraint automation_rules_template_check
  check (template in ('afterHours', 'criticalFault', 'geofenceEnter', 'overspeed', 'idling',
                      'restDay'));

commit;
