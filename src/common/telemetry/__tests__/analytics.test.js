import { describe, expect, it } from 'vitest';
import { analyticsRequest, browserOptedOut, parseAnalytics } from '../analytics';
import { telemetryConfig, telemetryEnvProblems } from '../config';

const VIEW = {
  route: '/settings/device/:id',
  hostname: 'app.example.com',
  language: 'he',
  screen: '1280x800',
  anonId: 'tab-1',
};

describe('parseAnalytics', () => {
  it('needs a known provider, an https address and a site', () => {
    expect(
      parseAnalytics({ provider: 'umami', url: 'https://a.example.com/', site: 'abc-123' }),
    ).toEqual({
      provider: 'umami',
      url: 'https://a.example.com',
      site: 'abc-123',
    });
    expect(parseAnalytics({ provider: 'ga', url: 'https://a.example.com', site: 'x' })).toBeNull();
    expect(
      parseAnalytics({ provider: 'umami', url: 'http://a.example.com', site: 'x' }),
    ).toBeNull();
    expect(
      parseAnalytics({ provider: 'umami', url: 'https://a.example.com', site: '' }),
    ).toBeNull();
    expect(
      parseAnalytics({ provider: 'umami', url: 'https://a.example.com', site: '<x>' }),
    ).toBeNull();
    expect(parseAnalytics({})).toBeNull();
  });
});

describe('analyticsRequest', () => {
  it('builds an Umami page view', () => {
    const request = analyticsRequest(
      { provider: 'umami', url: 'https://u.example.com', site: 'w1' },
      VIEW,
    );
    expect(request.url).toBe('https://u.example.com/api/send');
    expect(request.body).toEqual({
      type: 'event',
      payload: {
        website: 'w1',
        hostname: 'app.example.com',
        language: 'he',
        screen: '1280x800',
        url: '/settings/device/:id',
        referrer: '',
        title: '',
      },
    });
  });

  it('builds a Plausible event', () => {
    const request = analyticsRequest(
      { provider: 'plausible', url: 'https://p.example.com', site: 'app.example.com' },
      { ...VIEW, name: 'report_export', props: { type: 'trips' } },
    );
    expect(request).toEqual({
      url: 'https://p.example.com/api/event',
      contentType: 'text/plain',
      body: {
        name: 'report_export',
        url: 'https://app.example.com/settings/device/:id',
        domain: 'app.example.com',
        referrer: null,
        props: { type: 'trips' },
      },
    });
  });

  it('builds an anonymous PostHog page view', () => {
    const request = analyticsRequest(
      { provider: 'posthog', url: 'https://ph.example.com', site: 'phc_x' },
      VIEW,
    );
    expect(request.url).toBe('https://ph.example.com/capture/');
    expect(request.body).toMatchObject({
      api_key: 'phc_x',
      event: '$pageview',
      distinct_id: 'tab-1',
      properties: {
        $pathname: '/settings/device/:id',
        $process_person_profile: false,
        $screen_width: 1280,
      },
    });
  });
});

describe('browserOptedOut', () => {
  it('honours Do Not Track and Global Privacy Control', () => {
    expect(browserOptedOut({ doNotTrack: '1' })).toBe(true);
    expect(browserOptedOut({ globalPrivacyControl: true })).toBe(true);
    expect(browserOptedOut({ doNotTrack: '0' })).toBe(false);
    expect(browserOptedOut(undefined)).toBe(false);
  });
});

describe('telemetryConfig', () => {
  it('is off by default except our own metrics', () => {
    expect(telemetryConfig({})).toEqual({ errors: null, analytics: null, metrics: true });
    expect(telemetryConfig({ VITE_CLIENT_METRICS: 'off' }).metrics).toBe(false);
  });

  it('reads the services from the build', () => {
    const config = telemetryConfig({
      VITE_ERROR_DSN: 'https://k@glitchtip.example.com/3',
      VITE_ANALYTICS_PROVIDER: 'plausible',
      VITE_ANALYTICS_URL: 'https://plausible.example.com',
      VITE_ANALYTICS_SITE: 'app.example.com',
    });
    expect(config.errors.host).toBe('glitchtip.example.com');
    expect(config.analytics.provider).toBe('plausible');
  });

  it('refuses settings that would silently do nothing', () => {
    expect(telemetryEnvProblems({})).toEqual([]);
    expect(
      telemetryEnvProblems({ VITE_ERROR_DSN: 'https://glitchtip.example.com/3' }),
    ).toHaveLength(1);
    expect(telemetryEnvProblems({ VITE_ANALYTICS_PROVIDER: 'umami' })).toHaveLength(1);
    expect(telemetryEnvProblems({ VITE_CLIENT_METRICS: 'no' })).toHaveLength(1);
  });
});
