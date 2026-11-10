import { describe, expect, it, vi } from 'vitest';
import {
  buildEvent,
  createErrorReporter,
  envelope,
  parseDsn,
  parseStack,
  shouldIgnore,
} from '../errors';

const CHROME_STACK = `TypeError: Cannot read properties of undefined (reading 'name')
    at DeviceRow (https://app.example.com/assets/index-abc.js:12:345)
    at renderWithHooks (https://app.example.com/assets/react-def.js:1:2000)
    at https://app.example.com/assets/index-abc.js?x=1:3:4`;

const GECKO_STACK = `DeviceRow@https://app.example.com/assets/index-abc.js:12:345
@https://app.example.com/assets/index-abc.js:3:4`;

describe('parseDsn', () => {
  it('reads a Sentry or GlitchTip DSN', () => {
    expect(parseDsn('https://abc123@errors.example.com/7')).toEqual({
      host: 'errors.example.com',
      project: '7',
      endpoint:
        'https://errors.example.com/api/7/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=viper-fleet%2F1.0',
    });
    expect(parseDsn('https://k@o1.ingest.sentry.io/prefix/42').endpoint).toMatch(
      /^https:\/\/o1\.ingest\.sentry\.io\/prefix\/api\/42\/envelope\/\?/,
    );
  });

  it('refuses anything else', () => {
    expect(parseDsn('')).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn('not a url')).toBeNull();
    expect(parseDsn('https://errors.example.com/7')).toBeNull();
    expect(parseDsn('https://k@errors.example.com/project')).toBeNull();
    expect(parseDsn('http://k@errors.example.com/7')).toBeNull();
    expect(parseDsn('http://k@localhost:8000/1')).not.toBeNull();
  });
});

describe('parseStack', () => {
  it('reads Chromium stacks, oldest call first, without query strings', () => {
    const frames = parseStack(CHROME_STACK);
    expect(frames).toHaveLength(3);
    expect(frames[2]).toEqual({
      function: 'DeviceRow',
      filename: 'https://app.example.com/assets/index-abc.js',
      lineno: 12,
      colno: 345,
      in_app: true,
    });
    expect(frames[0]).toMatchObject({
      function: '?',
      filename: 'https://app.example.com/assets/index-abc.js',
      lineno: 3,
    });
  });

  it('reads Firefox and Safari stacks', () => {
    const frames = parseStack(GECKO_STACK);
    expect(frames.map((frame) => frame.function)).toEqual(['?', 'DeviceRow']);
  });

  it('marks extensions as not ours', () => {
    const [frame] = parseStack('    at x (chrome-extension://abc/content.js:1:1)');
    expect(frame.in_app).toBe(false);
  });
});

describe('shouldIgnore', () => {
  it('skips noise and errors handled elsewhere', () => {
    expect(shouldIgnore(new DOMException('aborted', 'AbortError'), [])).toBe(true);
    expect(shouldIgnore('Script error.', [])).toBe(true);
    expect(
      shouldIgnore(new Error('ResizeObserver loop completed with undelivered notifications.'), []),
    ).toBe(true);
    expect(
      shouldIgnore(new TypeError('Failed to fetch dynamically imported module: x.js'), []),
    ).toBe(true);
    expect(shouldIgnore(new Error('x'), [{ filename: 'chrome-extension://abc/a.js' }])).toBe(true);
    expect(shouldIgnore(new Error('x'), [{ filename: 'https://app/a.js' }])).toBe(false);
  });
});

describe('buildEvent', () => {
  it('describes the error without personal data', () => {
    const error = new TypeError('No vehicle 12-345-67 for dana@example.com');
    error.stack = CHROME_STACK;
    const event = buildEvent({
      error,
      source: 'boundary',
      release: '1.0.0+3f2a9c1',
      environment: 'production',
      route: '/settings/device/42',
      language: 'he',
      now: 1700000000000,
      eventId: 'e'.repeat(32),
    });
    expect(event).toMatchObject({
      event_id: 'e'.repeat(32),
      timestamp: 1700000000,
      platform: 'javascript',
      release: '1.0.0+3f2a9c1',
      environment: 'production',
      transaction: '/settings/device/:id',
      tags: { source: 'boundary', route: '/settings/device/:id', language: 'he' },
    });
    const [value] = event.exception.values;
    expect(value.type).toBe('TypeError');
    expect(value.value).toBe('No vehicle [plate] for [email]');
    expect(value.stacktrace.frames).toHaveLength(3);
    expect(value.mechanism).toEqual({ type: 'boundary', handled: true });
    expect(JSON.stringify(event)).not.toMatch(/dana|12-345-67|\?x=1/);
  });

  it('accepts values that are not errors', () => {
    const event = buildEvent({
      error: 'plain text',
      source: 'rejection',
      release: 'r',
      environment: 'e',
      route: '/',
    });
    expect(event.exception.values[0]).toMatchObject({ type: 'Error', value: 'plain text' });
    expect(event.exception.values[0].stacktrace).toBeUndefined();
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('envelope', () => {
  it('is three JSON lines', () => {
    const lines = envelope({ event_id: 'a' }, 0)
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(lines).toEqual([
      { event_id: 'a', sent_at: '1970-01-01T00:00:00.000Z' },
      { type: 'event' },
      { event_id: 'a' },
    ]);
  });
});

describe('createErrorReporter', () => {
  const setup = (options = {}) => {
    const transport = vi.fn();
    let time = 0;
    const reporter = createErrorReporter({
      dsn: 'https://k@errors.example.com/1',
      release: 'r',
      environment: 'test',
      transport,
      now: () => time,
      ...options,
    });
    return {
      reporter,
      transport,
      advance: (ms) => {
        time += ms;
      },
    };
  };

  it('does nothing without a DSN', () => {
    const transport = vi.fn();
    const reporter = createErrorReporter({ dsn: undefined, transport });
    expect(reporter.enabled).toBe(false);
    expect(reporter.capture(new Error('x'))).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it('sends an envelope to the project', () => {
    const { reporter, transport } = setup();
    expect(reporter.capture(new Error('boom'))).toBe(true);
    const [url, body] = transport.mock.calls[0];
    expect(url).toMatch(/^https:\/\/errors\.example\.com\/api\/1\/envelope\/\?sentry_key=k/);
    expect(JSON.parse(body.split('\n')[2]).exception.values[0].value).toBe('boom');
  });

  it('sends the same error once a minute and caps a page load', () => {
    const { reporter, transport, advance } = setup({ maxPerPage: 3 });
    // Thrown from the same place, as in a render loop.
    const fail = (message) => new Error(message);
    reporter.capture(fail('same'));
    reporter.capture(fail('same'));
    expect(transport).toHaveBeenCalledTimes(1);
    advance(61000);
    reporter.capture(fail('same'));
    reporter.capture(fail('other'));
    reporter.capture(fail('third'));
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it('skips ignored errors', () => {
    const { reporter, transport } = setup();
    expect(reporter.capture(new Error('ResizeObserver loop limit exceeded'))).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });
});
