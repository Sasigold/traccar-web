-- viper fleet: short courses built from a procedure (AI-10). Idempotent.
--
-- The manager uploads a procedure PDF; the fleet-ai function (/course) turns it into a short
-- Hebrew course with a quiz; the manager reviews it and publishes it. Drivers take it in their
-- portal: they get the quiz without the answers, the score is worked out here, and a pass is
-- written into the driver's file (driver_trainings) by itself.
-- Who: safety.read reads courses and results, safety.write writes courses; a driver sees only
-- published courses of their organization, through the functions below.

begin;

-- The model call is counted like the other AI calls.
alter table public.ai_usage drop constraint if exists ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('ask', 'dtc', 'extract', 'insights', 'course'));

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
  if p_kind not in ('ask', 'dtc', 'extract', 'insights', 'course') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  -- AI-10: building a course is the safety officer's job.
  if p_kind = 'course' and not public.has_permission('safety.write') then
    raise exception 'not allowed' using errcode = '42501';
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

create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120),
  summary text,
  sections jsonb not null default '[]' check (jsonb_typeof(sections) = 'array'),
  quiz jsonb not null default '[]' check (jsonb_typeof(quiz) = 'array'),
  pass_score integer not null default 80 check (pass_score between 1 and 100),
  valid_months integer check (valid_months is null or valid_months between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source_path text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_courses_org_idx on public.training_courses (org_id);

create table if not exists public.course_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid not null references public.training_courses (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  answers integer[] not null default '{}',
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  completed_at timestamptz not null default now()
);

create index if not exists course_completions_org_idx on public.course_completions (org_id);
create index if not exists course_completions_course_idx on public.course_completions (course_id);
create index if not exists course_completions_driver_idx on public.course_completions (driver_id, completed_at desc);

alter table public.training_courses enable row level security;
alter table public.course_completions enable row level security;

drop policy if exists training_courses_select on public.training_courses;
create policy training_courses_select on public.training_courses for select
  using (org_id = (select public.current_org_id()) and (select public.has_permission('safety.read')));
drop policy if exists training_courses_write on public.training_courses;
create policy training_courses_write on public.training_courses for all
  using (org_id = (select public.current_org_id()) and (select public.has_permission('safety.write')))
  with check (org_id = (select public.current_org_id()) and (select public.has_permission('safety.write')));

drop policy if exists course_completions_select on public.course_completions;
create policy course_completions_select on public.course_completions for select
  using (org_id = (select public.current_org_id())
         and ((select public.has_permission('safety.read')) or driver_id = (select public.my_driver_id())));

grant select, insert, update, delete on public.training_courses to authenticated;
grant select on public.course_completions to authenticated;

drop trigger if exists training_courses_updated_at on public.training_courses;
create trigger training_courses_updated_at before update on public.training_courses
  for each row execute function public.set_updated_at();
drop trigger if exists training_courses_audit on public.training_courses;
create trigger training_courses_audit after insert or update or delete on public.training_courses
  for each row execute function public.audit_row();

-- The driver's published courses, with their best result, and each course's quiz without answers.
create or replace function public.my_courses()
returns table (id uuid, title text, summary text, sections jsonb, quiz jsonb, pass_score integer,
               best_score integer, passed boolean, completed_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.title, c.summary, c.sections,
         (select coalesce(jsonb_agg(jsonb_build_object('question', q -> 'question',
                                                        'options', q -> 'options') order by n), '[]')
            from jsonb_array_elements(c.quiz) with ordinality as x(q, n)),
         c.pass_score,
         (select max(score) from public.course_completions k
           where k.course_id = c.id and k.driver_id = public.my_driver_id()),
         coalesce((select bool_or(passed) from public.course_completions k
                    where k.course_id = c.id and k.driver_id = public.my_driver_id()), false),
         (select max(completed_at) from public.course_completions k
           where k.course_id = c.id and k.driver_id = public.my_driver_id())
    from public.training_courses c
   where c.org_id = public.current_org_id() and c.status = 'published'
     and public.my_driver_id() is not null
   order by c.created_at desc
$$;

revoke all on function public.my_courses() from public, anon;
grant execute on function public.my_courses() to authenticated;

-- A driver's answers: scored here, kept, and a pass goes into their file. Returns the score, the
-- result and the right answers with their explanations (shown after submitting).
create or replace function public.submit_course(p_course uuid, p_answers integer[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_driver uuid := public.my_driver_id();
  v_course public.training_courses;
  v_total integer;
  v_right integer := 0;
  v_score integer;
  v_passed boolean;
  i integer;
begin
  if v_driver is null then
    raise exception 'only a driver takes a course' using errcode = '42501';
  end if;
  select * into v_course from public.training_courses
   where id = p_course and org_id = public.current_org_id() and status = 'published';
  if v_course.id is null then
    raise exception 'no such course' using errcode = '42501';
  end if;
  v_total := jsonb_array_length(v_course.quiz);
  if v_total = 0 or coalesce(array_length(p_answers, 1), 0) <> v_total then
    raise exception 'answer every question' using errcode = '22023';
  end if;
  for i in 1..v_total loop
    if p_answers[i] = (v_course.quiz -> (i - 1) ->> 'answer')::integer then
      v_right := v_right + 1;
    end if;
  end loop;
  v_score := round(100.0 * v_right / v_total);
  v_passed := v_score >= v_course.pass_score;
  insert into public.course_completions (org_id, course_id, driver_id, answers, score, passed)
  values (v_course.org_id, v_course.id, v_driver, p_answers, v_score, v_passed);
  if v_passed then
    insert into public.driver_trainings (org_id, driver_id, topic, held_at, valid_until, signed_at, notes)
    values (v_course.org_id, v_driver, v_course.title, public.ai_today(),
            case when v_course.valid_months is not null
                 then (public.ai_today() + make_interval(months => v_course.valid_months))::date end,
            now(), format('הדרכה דיגיטלית, ציון %s', v_score));
  end if;
  return jsonb_build_object(
    'score', v_score,
    'passed', v_passed,
    'answers', (select jsonb_agg(jsonb_build_object('answer', q -> 'answer',
                                                   'explanation', q -> 'explanation') order by n)
                  from jsonb_array_elements(v_course.quiz) with ordinality as x(q, n)));
end;
$$;

revoke all on function public.submit_course(uuid, integer[]) from public, anon;
grant execute on function public.submit_course(uuid, integer[]) to authenticated;

commit;
