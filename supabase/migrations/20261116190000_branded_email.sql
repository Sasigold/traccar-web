-- viper fleet: branded email (BRD-08). Idempotent.
--
-- Email goes out as HTML in the brand (BRAND.md §4, §8): a navy band with the reverse logo,
-- a paper body with a white card, ink text, and one aqua button with ink text that opens the
-- service. The plain text stays as the text part. The logo is served by the web app
-- (public/brand-email-logo.png), so the email channel keeps the app's address in `site_url`;
-- without it the band has no logo and the email has no button.

begin;

alter table public.messaging_channels add column if not exists site_url text;
alter table public.messaging_channels drop constraint if exists messaging_channels_site_url_check;
alter table public.messaging_channels add constraint messaging_channels_site_url_check
  check (site_url is null or site_url ~ '^https://[^\s/]+(/[^\s]*)?$');

comment on column public.messaging_channels.site_url is
  'The web app''s https address: the email logo is loaded from it and the button opens it.';

-- Text into HTML: escaped, line breaks kept.
create or replace function public.messaging_html_text(p_text text)
returns text
language sql
immutable
as $$
  select replace(
    replace(replace(replace(replace(coalesce(p_text, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
      '"', '&quot;'),
    E'\n', '<br>');
$$;

-- The email body. Colors are the brand tokens (navy #102C54, aqua #35D7D6, paper #F8FCFD,
-- ink #0A1C30, slate #567286, ice #E1F5F7); email clients need them inline.
create or replace function public.messaging_email_html(p_subject text, p_body text, p_site_url text)
returns text
language plpgsql
immutable
as $$
declare
  site text := nullif(rtrim(coalesce(p_site_url, ''), '/'), '');
  logo text := '';
  button text := '';
begin
  if site is not null then
    logo := format(
      '<img src="%s/brand-email-logo.png" width="160" height="31" alt="viper fleet" '
      'style="display:block;border:0;height:31px;width:160px">',
      public.messaging_html_text(site));
    button := format(
      '<tr><td style="padding:8px 32px 32px">'
      '<a href="%s" style="display:inline-block;background:#35D7D6;color:#0A1C30;'
      'font-weight:600;text-decoration:none;padding:12px 24px;border-radius:999px">'
      'פתיחת viper fleet</a></td></tr>',
      public.messaging_html_text(site));
  end if;
  return format(
    '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width"><title>%1$s</title></head>'
    '<body style="margin:0;padding:0;background:#F8FCFD;color:#0A1C30;'
    'font-family:Assistant,Sora,Arial,sans-serif;direction:rtl">'
    '<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#F8FCFD">'
    '<tr><td align="center" style="padding:24px 12px">'
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
    'style="max-width:600px;width:100%%;background:#FFFFFF;border:1px solid #E1F5F7;border-radius:16px;overflow:hidden">'
    '<tr><td dir="ltr" style="background:#102C54;padding:20px 32px">%2$s</td></tr>'
    '<tr><td style="padding:32px 32px 8px">'
    '<div style="font-family:Sora,Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#567286;text-align:right" dir="ltr">'
    'SYNC POINT / ALERT</div>'
    '<h1 style="margin:8px 0 16px;font-size:22px;line-height:1.3;color:#0A1C30">%1$s</h1>'
    '<p style="margin:0;font-size:16px;line-height:1.6;color:#0A1C30">%3$s</p></td></tr>'
    '%4$s'
    '</table>'
    '<p style="margin:16px 0 0;font-size:12px;color:#567286">'
    'קיבלתם את ההודעה כי אתם ברשימת הנמענים של הארגון ב-viper fleet. להסרה, פנו למנהל המערכת.</p>'
    '</td></tr></table></body></html>',
    public.messaging_html_text(coalesce(p_subject, 'viper fleet')),
    logo,
    public.messaging_html_text(p_body),
    button);
end;
$$;

create or replace function public.messaging_request(
  p_channel public.messaging_channels,
  p_secret text,
  p_delivery public.notification_deliveries
)
returns table (url text, headers jsonb, body jsonb)
language plpgsql
stable
as $$
declare
  address text := public.messaging_address(p_delivery.channel, p_delivery.address);
  html text := case when p_delivery.channel = 'email'
    then public.messaging_email_html(p_delivery.subject, p_delivery.body, p_channel.site_url) end;
begin
  if p_channel.provider = 'webhook' then
    return query select p_channel.sender,
      jsonb_build_object('Authorization', 'Bearer ' || p_secret, 'Content-Type', 'application/json'),
      jsonb_strip_nulls(jsonb_build_object('channel', p_delivery.channel, 'to', address,
                         'subject', p_delivery.subject, 'text', p_delivery.body, 'html', html,
                         'kind', p_delivery.kind, 'id', p_delivery.id));
  elsif p_channel.provider = 'meta' then
    return query select format('https://graph.facebook.com/v21.0/%s/messages', p_channel.sender),
      jsonb_build_object('Authorization', 'Bearer ' || p_secret, 'Content-Type', 'application/json'),
      jsonb_build_object(
        'messaging_product', 'whatsapp', 'to', address, 'type', 'template',
        'template', jsonb_build_object(
          'name', p_channel.template,
          'language', jsonb_build_object('code', p_channel.language),
          'components', jsonb_build_array(jsonb_build_object(
            'type', 'body',
            'parameters', jsonb_build_array(jsonb_build_object(
              'type', 'text',
              -- WhatsApp parameters take no line breaks or tabs.
              'text', regexp_replace(p_delivery.body, '[\n\t]+', ' ', 'g')))))));
  elsif p_channel.provider = 'vonage' then
    -- The key is "api_key:api_secret".
    return query select 'https://rest.nexmo.com/sms/json',
      jsonb_build_object('Content-Type', 'application/json'),
      jsonb_build_object('api_key', split_part(p_secret, ':', 1),
                         'api_secret', split_part(p_secret, ':', 2),
                         'from', p_channel.sender, 'to', address, 'text', p_delivery.body,
                         'type', 'unicode');
  elsif p_channel.provider = 'resend' then
    return query select 'https://api.resend.com/emails',
      jsonb_build_object('Authorization', 'Bearer ' || p_secret, 'Content-Type', 'application/json'),
      jsonb_build_object('from', p_channel.sender, 'to', jsonb_build_array(address),
                         'subject', coalesce(p_delivery.subject, 'viper fleet'),
                         'text', p_delivery.body, 'html', html);
  end if;
end;
$$;

commit;
