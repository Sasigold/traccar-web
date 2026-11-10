-- viper fleet: AI features (AI-01 fleet questions, AI-02 morning insights, AI-03 fault codes,
-- AI-04 document scanning). Idempotent.
--
-- The model is called only by the fleet-ai edge function, with a key kept in Vault
-- (ai_set_secret); the browser never sees it. Each organization can switch the AI off and has a
-- daily request limit; usage is counted per day and kind. The fault-code library is shared by
-- every organization: a code explained once is read from here afterwards.

begin;

-- ─── settings and usage ──────────────────────────────────────────────────────

create table if not exists public.ai_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  enabled boolean not null default true,
  daily_limit integer not null default 200 check (daily_limit between 0 and 10000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.ai_settings enable row level security;

drop policy if exists ai_settings_read on public.ai_settings;
create policy ai_settings_read on public.ai_settings for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists ai_settings_write on public.ai_settings;
create policy ai_settings_write on public.ai_settings for all to authenticated
  using (org_id = public.current_org_id() and public.has_permission('users.manage'))
  with check (org_id = public.current_org_id() and public.has_permission('users.manage'));

grant select, insert, update on public.ai_settings to authenticated;

create table if not exists public.ai_usage (
  org_id uuid not null references public.organizations (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('ask', 'dtc', 'extract', 'insights')),
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (org_id, day, kind)
);

alter table public.ai_usage enable row level security;
-- No policies: read through ai_status(), written by the functions below only.

-- The day in Israel, so the limit resets at local midnight.
create or replace function public.ai_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;

-- Called by the edge function with the user's token before each model call: the user must be an
-- active member of an organization whose AI is on and under its daily limit. Counts the request.
create or replace function public.ai_begin(p_kind text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org uuid;
  v_settings public.ai_settings;
  v_used integer;
begin
  select p.org_id into v_org
    from public.profiles p
   where p.id = auth.uid() and p.is_active;
  if v_org is null then
    raise exception 'not a member of an organization' using errcode = '42501';
  end if;
  if p_kind not in ('ask', 'dtc', 'extract', 'insights') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  select * into v_settings from public.ai_settings where org_id = v_org;
  if v_settings.org_id is not null and not v_settings.enabled then
    raise exception 'AI is switched off for this organization' using errcode = '42501';
  end if;
  select coalesce(sum(requests), 0) into v_used
    from public.ai_usage where org_id = v_org and day = public.ai_today();
  if v_used >= coalesce(v_settings.daily_limit, 200) then
    raise exception 'daily AI limit reached' using errcode = '53400';
  end if;
  insert into public.ai_usage (org_id, day, kind, requests)
  values (v_org, public.ai_today(), p_kind, 1)
  on conflict (org_id, day, kind) do update set requests = public.ai_usage.requests + 1;
  return v_org;
end;
$$;

revoke all on function public.ai_begin(text) from public, anon;
grant execute on function public.ai_begin(text) to authenticated;

-- The edge function adds the tokens a call used (service role only).
create or replace function public.ai_record_tokens(
  p_org uuid, p_kind text, p_input integer, p_output integer)
returns void
language sql
security definer
set search_path to 'public'
as $$
  insert into public.ai_usage (org_id, day, kind, input_tokens, output_tokens)
  values (p_org, public.ai_today(), p_kind, greatest(p_input, 0), greatest(p_output, 0))
  on conflict (org_id, day, kind) do update
    set input_tokens = public.ai_usage.input_tokens + excluded.input_tokens,
        output_tokens = public.ai_usage.output_tokens + excluded.output_tokens;
$$;

revoke all on function public.ai_record_tokens(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.ai_record_tokens(uuid, text, integer, integer) to service_role;

-- ─── the key ─────────────────────────────────────────────────────────────────

create or replace function public.ai_secret()
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  value text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into value using 'ai_anthropic_key';
  return value;
end;
$$;

revoke all on function public.ai_secret() from public, anon, authenticated;
grant execute on function public.ai_secret() to service_role;

create or replace function public.ai_set_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  secret_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(trim(p_secret), '') = '' then
    raise exception 'empty key' using errcode = '22023';
  end if;
  if to_regclass('vault.secrets') is null then
    raise exception 'Supabase Vault is not available' using errcode = '55000';
  end if;
  execute 'select id from vault.secrets where name = $1 limit 1'
    into secret_id using 'ai_anthropic_key';
  if secret_id is null then
    execute 'select vault.create_secret($1, $2)' using trim(p_secret), 'ai_anthropic_key';
  else
    execute 'select vault.update_secret($1, $2)' using secret_id, trim(p_secret);
  end if;
end;
$$;

revoke all on function public.ai_set_secret(text) from public, anon;
grant execute on function public.ai_set_secret(text) to authenticated;

-- What the settings screen shows: on or off, the limit, today's use, and whether a key is set.
create or replace function public.ai_status()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'enabled', coalesce((select enabled from public.ai_settings where org_id = o.org), true),
    'daily_limit', coalesce((select daily_limit from public.ai_settings where org_id = o.org), 200),
    'used_today', coalesce((select sum(requests) from public.ai_usage
                             where org_id = o.org and day = public.ai_today()), 0),
    'ready', public.ai_secret() is not null)
    from (select public.current_org_id() as org) o
   where o.org is not null;
$$;

revoke all on function public.ai_status() from public, anon;
grant execute on function public.ai_status() to authenticated;

-- ─── fault codes (AI-03) ─────────────────────────────────────────────────────

create table if not exists public.dtc_library (
  code text primary key check (code ~ '^[PBCU][0-9A-F]{4}$'),
  title_he text not null,
  explanation_he text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  drive_today text not null check (drive_today in ('yes', 'caution', 'no')),
  cost_min integer check (cost_min >= 0),
  cost_max integer check (cost_max >= cost_min),
  source text not null default 'library' check (source in ('library', 'ai')),
  created_at timestamptz not null default now()
);

alter table public.dtc_library enable row level security;

drop policy if exists dtc_library_read on public.dtc_library;
create policy dtc_library_read on public.dtc_library for select to authenticated using (true);
-- Written by the edge function (service role) only.
grant select on public.dtc_library to authenticated;
grant select, insert, update on public.dtc_library to service_role;

insert into public.dtc_library
  (code, title_he, explanation_he, severity, drive_today, cost_min, cost_max) values
  ('P0420', 'יעילות הממיר הקטליטי נמוכה',
   'הממיר הקטליטי לא מנקה את הפליטה כמו שצריך. לרוב אין סכנה מיידית, אבל הרכב עלול להיכשל בטסט.',
   'medium', 'yes', 800, 4500),
  ('P0300', 'החטאות הצתה בכמה צילינדרים',
   'המנוע מחטיא הצתה. נסיעה ממושכת עלולה להזיק לממיר ולמנוע; כדאי לבדוק מצתים וסלילים בהקדם.',
   'high', 'caution', 300, 2500),
  ('P0171', 'תערובת דלה (בנק 1)',
   'למנוע נכנס יותר מדי אוויר ביחס לדלק: לרוב דליפת ואקום או חיישן זרימת אוויר מלוכלך.',
   'medium', 'yes', 200, 1500),
  ('P0128', 'המנוע לא מגיע לחום עבודה',
   'בדרך כלל תרמוסטט תקוע פתוח. צריכת הדלק עולה והחימום חלש, אבל אפשר לסיים את היום.',
   'low', 'yes', 250, 900),
  ('P0442', 'דליפה קטנה במערכת אדי הדלק',
   'לרוב מכסה דלק שלא נסגר טוב. בדקו את המכסה; אם הקוד חוזר, צריך בדיקה במוסך.',
   'low', 'yes', 0, 800),
  ('P0217', 'התחממות יתר של המנוע',
   'המנוע חם מדי. עצרו במקום בטוח וכבו את המנוע: המשך נסיעה עלול להרוס אותו.',
   'critical', 'no', 500, 15000),
  ('P0524', 'לחץ שמן מנוע נמוך',
   'לחץ השמן נמוך. עצרו מיד ובדקו את מפלס השמן: נסיעה בלי לחץ שמן הורסת את המנוע.',
   'critical', 'no', 200, 20000),
  ('P0562', 'מתח מערכת נמוך',
   'המצבר או האלטרנטור לא מספקים מתח מלא. הרכב עלול לא להניע בפעם הבאה.',
   'medium', 'caution', 300, 2500),
  ('P0700', 'תקלה במערכת הבקרה של תיבת ההילוכים',
   'מחשב תיבת ההילוכים רשם תקלה. אם ההעברות תקינות אפשר להמשיך בזהירות ולקבוע בדיקה.',
   'high', 'caution', 500, 8000),
  ('P0500', 'תקלה בחיישן מהירות הרכב',
   'חיישן המהירות לא מדווח. מד המהירות ובקרת השיוט עלולים לא לעבוד.',
   'medium', 'caution', 300, 1200)
on conflict (code) do nothing;

-- ─── what this database can do ───────────────────────────────────────────────

create or replace function public.fleet_features()
returns text[]
language sql
stable
set search_path to 'public'
as $$
  select array_remove(array[
    case when to_regclass('public.dispatch_jobs') is not null then 'dispatch' end,
    case when to_regclass('public.work_orders') is not null then 'workOrders' end,
    case when to_regclass('public.inspections') is not null then 'inspections' end,
    case when to_regclass('public.incidents') is not null then 'incidents' end,
    case when to_regclass('public.vehicle_expenses') is not null then 'costs' end,
    case when to_regclass('public.driver_violations') is not null then 'safety' end,
    case when to_regclass('public.safety_procedures') is not null then 'safetyOfficer' end,
    case when to_regclass('public.pois') is not null then 'poi' end,
    case when to_regclass('public.document_alerts') is not null then 'alerts' end,
    case when to_regclass('public.api_keys') is not null then 'integrations' end,
    case when to_regclass('public.privacy_policies') is not null then 'privacy' end,
    case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'vehicles'
                         and column_name = 'asset_kind') then 'equipment' end,
    case when exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'vehicles'
                         and column_name = 'asset_kind') then 'sensors' end,
    case when to_regclass('public.ai_settings') is not null then 'ai' end
  ], null)
$$;

revoke all on function public.fleet_features() from public, anon;
grant execute on function public.fleet_features() to authenticated;

commit;
