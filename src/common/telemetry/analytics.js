// Product analytics (FND-06): which screens are used, so the roadmap is prioritized by real use.
// Self-hosted and cookieless: Umami, Plausible or PostHog, chosen by the build
// (VITE_ANALYTICS_PROVIDER, VITE_ANALYTICS_URL, VITE_ANALYTICS_SITE); off without them.
//
// No third-party script is loaded: the app sends each page view itself, to the service's own
// collection endpoint. What is sent: the page as a template ("/settings/device/:id"), the
// language, the screen size and, for PostHog only, a random id that lives in this tab and is gone
// when it closes. Never a user, an e-mail, a device name or a query string. Users can turn it off
// in Preferences, and "Do Not Track" or "Global Privacy Control" turn it off too.

export const ANALYTICS_PROVIDERS = ['umami', 'plausible', 'posthog'];

export const parseAnalytics = ({ provider, url, site }) => {
  if (!ANALYTICS_PROVIDERS.includes(provider) || !site || !/^[\w.:-]{1,80}$/.test(site)) {
    return null;
  }
  try {
    const base = new URL(url);
    const local = /^(localhost|127\.0\.0\.1)$/.test(base.hostname);
    if (base.protocol !== 'https:' && !(local && base.protocol === 'http:')) {
      return null;
    }
    return { provider, url: base.href.replace(/\/+$/, ''), site };
  } catch {
    return null;
  }
};

// The request for one page view or event. `route` is already a template.
export const analyticsRequest = (
  config,
  { name, route, hostname, language, screen, anonId, props },
) => {
  const pageUrl = `https://${hostname}${route}`;
  switch (config.provider) {
    case 'umami':
      return {
        url: `${config.url}/api/send`,
        contentType: 'application/json',
        body: {
          type: 'event',
          payload: {
            website: config.site,
            hostname,
            language,
            screen,
            url: route,
            referrer: '',
            title: '',
            ...(name ? { name, data: props || {} } : {}),
          },
        },
      };
    case 'plausible':
      return {
        url: `${config.url}/api/event`,
        contentType: 'text/plain',
        body: {
          name: name || 'pageview',
          url: pageUrl,
          domain: config.site,
          referrer: null,
          ...(props ? { props } : {}),
        },
      };
    case 'posthog':
      return {
        url: `${config.url}/capture/`,
        contentType: 'text/plain',
        body: {
          api_key: config.site,
          event: name || '$pageview',
          distinct_id: anonId,
          properties: {
            $current_url: pageUrl,
            $pathname: route,
            $host: hostname,
            $screen_width: Number(String(screen).split('x')[0]) || undefined,
            $lib: 'viper-fleet',
            // An anonymous event: PostHog creates no person profile for it.
            $process_person_profile: false,
            language,
            ...(props || {}),
          },
        },
      };
    default:
      return null;
  }
};

// The browser asked not to be tracked.
export const browserOptedOut = (nav) =>
  Boolean(
    nav &&
    (nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes'),
  );

export const ANALYTICS_OPT_OUT_KEY = 'vfAnalyticsOptOut';
