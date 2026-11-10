import { describe, expect, it } from 'vitest';
import { routeTemplate, scrubText, scrubUrl } from '../scrub';

describe('scrubText', () => {
  it('removes tokens and API keys', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdEFGH1234';
    expect(scrubText(`bad token ${jwt}`)).toBe('bad token [token]');
    expect(scrubText(`key vf_${'a1'.repeat(20)} refused`)).toBe('key [key] refused');
    expect(scrubText('Authorization: Bearer abcdefghijkl')).toBe('Authorization: Bearer [token]');
  });

  it('drops query strings and fragments, and secrets in text', () => {
    expect(scrubText('GET https://x.example.com/api/a?token=123&b=2#frag failed')).toBe(
      'GET https://x.example.com/api/a failed',
    );
    expect(scrubText('password=hunter2 rejected')).toBe('password=[redacted] rejected');
  });

  it('removes personal details', () => {
    expect(scrubText('user dana@example.co.il')).toBe('user [email]');
    expect(scrubText('call 050-1234567 or +972 52 123 4567 or 03-1234567')).toBe(
      'call [phone] or [phone] or [phone]',
    );
    expect(scrubText('plate 12-345-67 and 123-45-678')).toBe('plate [plate] and [plate]');
    expect(scrubText('id 123456782')).toBe('id [number]');
    expect(scrubText('at 32.08531, 34.78177')).toBe('at [coords]');
  });

  it('keeps ordinary messages and short numbers', () => {
    expect(scrubText("Cannot read properties of undefined (reading 'id')")).toBe(
      "Cannot read properties of undefined (reading 'id')",
    );
    expect(scrubText('HTTP 500 after 3 tries')).toBe('HTTP 500 after 3 tries');
  });

  it('handles empty values and caps the length', () => {
    expect(scrubText(null)).toBe('');
    expect(scrubText('x'.repeat(2000))).toHaveLength(1001);
  });
});

describe('routeTemplate', () => {
  it('turns ids and tokens into placeholders', () => {
    expect(routeTemplate('/settings/device/42')).toBe('/settings/device/:id');
    expect(routeTemplate('/fleet/vehicle/3f2a9c1d-0e5b-4a7c-8d9e-0f1a2b3c4d5e')).toBe(
      '/fleet/vehicle/:id',
    );
    expect(routeTemplate('/track/Ab3dEf9hIjKlMnOp')).toBe('/track/:token');
    expect(routeTemplate('/reports/combined?from=x#y')).toBe('/reports/combined');
  });

  it('is stable for templates and the root', () => {
    expect(routeTemplate('/settings/device/:id')).toBe('/settings/device/:id');
    expect(routeTemplate('/')).toBe('/');
    expect(routeTemplate('')).toBe('/');
    expect(routeTemplate('/a/')).toBe('/a');
    expect(routeTemplate('/search/דנה')).toBe('/search/:value');
  });
});

describe('scrubUrl', () => {
  it('keeps the script address only', () => {
    expect(scrubUrl('https://app.example.com/assets/index-abc.js?v=1')).toBe(
      'https://app.example.com/assets/index-abc.js',
    );
  });
});
