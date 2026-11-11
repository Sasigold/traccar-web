-- viper fleet: limits on fuel cards (ADM-31). Idempotent.
--
-- The fuel cards table exists since stage 1 and now has a screen. A card may have a daily limit
-- in liters and a monthly limit in shekels, as the fuel companies set them, so the manager sees
-- them next to the card.

begin;

alter table public.vehicle_fuel_cards
  add column if not exists limit_liters_day numeric check (limit_liters_day is null or limit_liters_day > 0),
  add column if not exists limit_amount_month numeric check (limit_amount_month is null or limit_amount_month > 0);

commit;
