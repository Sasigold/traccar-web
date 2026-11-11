-- Branded email (BRD-08): HTML in the brand, escaped text, the logo and button from site_url.
\set ON_ERROR_STOP 1
begin;

do $$
declare
  html text := public.messaging_email_html('תזכורת <תוקף>', E'שורה 1\nשורה & 2', 'https://fleet.example.co.il/');
  bare text := public.messaging_email_html('נושא', 'גוף', null);
  channel public.messaging_channels;
  delivery public.notification_deliveries;
  request record;
begin
  assert html like '%dir="rtl"%', 'right to left';
  assert html like '%background:#102C54%' and html like '%background:#35D7D6;color:#0A1C30%',
    'a navy band and an aqua button with ink text';
  assert html like '%https://fleet.example.co.il/brand-email-logo.png%', 'the logo from the app';
  assert html like '%href="https://fleet.example.co.il"%', 'the button opens the app';
  assert html like '%תזכורת &lt;תוקף&gt;%' and html like '%שורה 1<br>שורה &amp; 2%',
    'text is escaped and keeps its lines';
  assert html like '%SYNC POINT / ALERT%', 'the brand label';
  assert bare not like '%<img%' and bare not like '%<a %', 'no logo or button without site_url';

  begin
    insert into public.messaging_channels (channel, provider, sender, site_url)
    values ('email', 'resend', 'viper fleet <alerts@example.com>', 'http://fleet.example.com');
    assert false, 'site_url must be https';
  exception when check_violation then null;
  end;

  channel := row('email', 'resend', true, 'viper fleet <alerts@example.com>', null, 'he', now(),
                 'https://fleet.example.co.il')::public.messaging_channels;
  delivery.channel := 'email';
  delivery.address := 'ops@example.com';
  delivery.subject := 'נושא';
  delivery.body := 'גוף';
  select * into request from public.messaging_request(channel, 'key', delivery);
  assert request.body ->> 'text' = 'גוף', 'the plain text stays';
  assert request.body ->> 'html' like '%<h1%נושא</h1>%', 'and the HTML goes with it';

  delivery.channel := 'sms';
  channel.channel := 'sms';
  channel.provider := 'webhook';
  channel.sender := 'https://gateway.example.com/send';
  select * into request from public.messaging_request(channel, 'key', delivery);
  assert not (request.body ? 'html'), 'only email carries HTML';
end $$;

rollback;
\echo 'branded_email.test.sql: all assertions passed'
