-- AI-10: courses from a procedure: drafts stay with the managers, a driver gets the quiz without
-- the answers, the score is computed here, and a pass lands in the driver's file.
\set ON_ERROR_STOP 1
begin;

create or replace function pg_temp.as_user(p_id text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id, true);
  execute 'set local role authenticated';
end $$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path to 'public' as $$
  select case public.current_role_name()
    when 'owner' then p_permission in ('safety.read', 'safety.write')
    else false end
$$;

insert into public.organizations (id, name) values ('5c000000-0000-0000-0000-000000000000', 'Fleet');
insert into public.profiles (id, org_id, role) values
  ('00000000-0000-0000-0000-0000000005c1', '5c000000-0000-0000-0000-000000000000', 'owner'),
  ('00000000-0000-0000-0000-0000000005c2', '5c000000-0000-0000-0000-000000000000', 'driver');
insert into public.drivers (id, org_id, profile_id, full_name) values
  ('5c000000-0000-0000-0000-0000000000d1', '5c000000-0000-0000-0000-000000000000',
   '00000000-0000-0000-0000-0000000005c2', 'Dana');

select pg_temp.as_user('00000000-0000-0000-0000-0000000005c1');
do $$ begin
  insert into public.training_courses (id, org_id, title, sections, quiz, pass_score, valid_months, status)
  values ('5c000000-0000-0000-0000-0000000000c1', '5c000000-0000-0000-0000-000000000000', 'בדיקת בוקר',
          '[{"heading":"צמיגים","points":["לחץ"]}]',
          '[{"question":"q1","options":["a","b","c","d"],"answer":1,"explanation":"e1"},
            {"question":"q2","options":["a","b","c","d"],"answer":2,"explanation":"e2"}]',
          100, 12, 'draft');
  assert public.ai_begin('course') is not null, 'the safety officer may build a course';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000005c2');
do $$ begin
  assert (select count(*) from public.my_courses()) = 0, 'a draft is not shown to drivers';
  assert (select count(*) from public.training_courses) = 0, 'drivers do not read the table';
  begin
    perform public.ai_begin('course');
    assert false, 'a driver does not build courses';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000005c1');
update public.training_courses set status = 'published';

select pg_temp.as_user('00000000-0000-0000-0000-0000000005c2');
do $$
declare
  result jsonb;
begin
  assert (select count(*) from public.my_courses()) = 1, 'published, it is shown';
  assert not ((select quiz from public.my_courses()) -> 0 ? 'answer'), 'without the answers';
  begin
    perform public.submit_course('5c000000-0000-0000-0000-0000000000c1', array[1]);
    assert false, 'every question is answered';
  exception when invalid_parameter_value then null;
  end;
  result := public.submit_course('5c000000-0000-0000-0000-0000000000c1', array[1, 3]);
  assert (result ->> 'score')::integer = 50 and not (result ->> 'passed')::boolean, 'half right fails';
  assert (result -> 'answers' -> 1 ->> 'answer')::integer = 2, 'and the right answers come back';
  assert (select count(*) from public.driver_trainings) = 0, 'a fail is not in the file';
  result := public.submit_course('5c000000-0000-0000-0000-0000000000c1', array[1, 2]);
  assert (result ->> 'passed')::boolean, 'all right passes';
  assert (select passed from public.my_courses()), 'the course shows as passed';
  assert (select count(*) from public.course_completions) = 2, 'the driver sees their own results';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000005c1');
do $$ begin
  assert (select count(*) from public.driver_trainings
           where topic = 'בדיקת בוקר' and valid_until is not null and signed_at is not null) = 1,
    'a pass is written into the driver file, valid for the course''s months';
end $$;

rollback;
\echo 'training_courses.test.sql: all assertions passed'
