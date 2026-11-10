-- ISR-12: the license issue date is stored on the driver.
begin;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'drivers'
      and column_name = 'license_issued' and data_type = 'date'
  ) then
    raise exception 'drivers.license_issued is missing';
  end if;
end $$;
rollback;
