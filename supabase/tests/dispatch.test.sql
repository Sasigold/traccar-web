-- Tracking links are removed when a job closes.
\set ON_ERROR_STOP 1
begin;
insert into public.organizations (id, name) values ('a0000000-0000-0000-0000-000000000000', 'Org');
insert into public.dispatch_jobs (id, org_id, title, tracking_link, tracking_expires_at)
values ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 'Delivery',
        'https://example/?token=abc', now() + interval '6 hours');
update public.dispatch_jobs set status = 'en_route' where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select tracking_link from public.dispatch_jobs) is not null, 'link kept while the job is open';
end $$;
update public.dispatch_jobs set status = 'done' where id = '20000000-0000-0000-0000-000000000001';
do $$ begin
  assert (select tracking_link from public.dispatch_jobs) is null, 'link removed when the job is done';
  assert (select tracking_expires_at <= now() from public.dispatch_jobs), 'expiry cut to now';
end $$;
rollback;
\echo 'dispatch.test.sql: all assertions passed'
