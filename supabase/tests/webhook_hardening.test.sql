-- Webhooks (SEC-15): only public https addresses; each table sends only its listed fields.
\set ON_ERROR_STOP 1
begin;

do $$ begin
  assert public.webhook_url_allowed('https://hooks.example.com/viper'), 'a public name';
  assert public.webhook_url_allowed('https://hooks.example.com:443/x'), 'port 443';
  assert public.webhook_url_allowed('https://8.8.8.8/x'), 'a public address';
  assert not public.webhook_url_allowed('http://hooks.example.com/'), 'not https';
  assert not public.webhook_url_allowed('https://hooks.example.com:8443/'), 'another port';
  assert not public.webhook_url_allowed('https://localhost/'), 'localhost';
  assert not public.webhook_url_allowed('https://db.internal/'), 'an internal name';
  assert not public.webhook_url_allowed('https://kong/'), 'a bare container name';
  assert not public.webhook_url_allowed('https://10.0.0.5/'), 'private range';
  assert not public.webhook_url_allowed('https://172.17.0.1/'), 'docker bridge';
  assert not public.webhook_url_allowed('https://169.254.169.254/latest'), 'metadata';
  assert not public.webhook_url_allowed('https://[::1]/'), 'ipv6 loopback';
  assert not public.webhook_url_allowed('https://user@hooks.example.com/'), 'credentials in the address';
end $$;

insert into public.organizations (id, name) values ('ab000000-0000-0000-0000-000000000000', 'Hooks A');
do $$ begin
  begin
    insert into public.webhooks (org_id, name, url) values
      ('ab000000-0000-0000-0000-000000000000', 'inside', 'https://192.168.1.10/hook');
    assert false, 'an inside address is refused';
  exception when invalid_parameter_value then null;
  end;
  assert public.webhook_payload('dispatch_jobs',
    '{"id": "1", "status": "done", "customer_phone": "050", "tracking_link": "secret", "notes": "x"}')
    = '{"id": "1", "status": "done"}'::jsonb, 'only the listed fields';
  assert public.webhook_payload('unknown', '{"id": "1", "x": 2}') = '{"id": "1"}'::jsonb, 'unknown tables send the id';
  assert public.webhook_failure(503, null) = 'http_5xx' and public.webhook_failure(null, 'Timeout was reached') = 'timeout',
    'only the kind of failure';
end $$;

rollback;
\echo 'webhook_hardening.test.sql: all assertions passed'
