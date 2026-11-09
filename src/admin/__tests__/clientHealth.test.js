import { describe, expect, it } from 'vitest';
import {
  fill,
  formatDuration,
  formatVital,
  releaseHealth,
  releasesOf,
  splitCounter,
  vitalRating,
} from '../clientHealth';

const ROWS = [
  { release: '1.0.0+bbbbbbb', kind: 'vital', name: 'INP', samples: 4, p75: 240, good: 0.5 },
  { release: '1.0.0+bbbbbbb', kind: 'vital', name: 'LCP', samples: 10, p75: 1900, good: 0.9 },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'counter',
    name: 'fleet_error.42501',
    total: 2,
    orgs: 1,
    last_at: 't',
  },
  { release: '1.0.0+bbbbbbb', kind: 'counter', name: 'zz_other', total: 1, orgs: 1, last_at: 't' },
  {
    release: '1.0.0+bbbbbbb',
    kind: 'counter',
    name: 'socket_disconnect',
    total: 7,
    orgs: 2,
    last_at: 't',
  },
  { release: '1.0.0+bbbbbbb', kind: 'longtask', name: 'count', total: 12, maximum: 3 },
  { release: '1.0.0+bbbbbbb', kind: 'longtask', name: 'total_ms', total: 1500, maximum: 600 },
  { release: '1.0.0+bbbbbbb', kind: 'longtask', name: 'max_ms', total: 700, maximum: 320 },
  { release: '1.0.0+aaaaaaa', kind: 'vital', name: 'LCP', samples: 3, p75: 5000, good: 0 },
];

describe('vitalRating', () => {
  it('uses the web vitals thresholds', () => {
    expect(vitalRating('LCP', 2500)).toBe('good');
    expect(vitalRating('LCP', 2501)).toBe('needs-improvement');
    expect(vitalRating('LCP', 4001)).toBe('poor');
    expect(vitalRating('CLS', 0.05)).toBe('good');
    expect(vitalRating('INP', 600)).toBe('poor');
    expect(vitalRating('FID', 10)).toBeNull();
    expect(vitalRating('LCP', null)).toBeNull();
  });
});

describe('formatVital', () => {
  it('shows milliseconds, seconds, or no unit for CLS', () => {
    expect(formatVital('INP', 180.4, 'en')).toBe('180 ms');
    expect(formatVital('LCP', 2345, 'en')).toBe('2.35 s');
    expect(formatVital('CLS', 0.12345, 'en')).toBe('0.123');
    expect(formatVital('LCP', null)).toBe('–');
  });
});

describe('releaseHealth', () => {
  it('lists releases newest first', () => {
    expect(releasesOf(ROWS)).toEqual(['1.0.0+bbbbbbb', '1.0.0+aaaaaaa']);
    expect(releasesOf(null)).toEqual([]);
  });

  it('describes one release', () => {
    const health = releaseHealth(ROWS, '1.0.0+bbbbbbb');
    expect(health.vitals.map((vital) => vital.name)).toEqual(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);
    expect(health.vitals[0]).toEqual({
      name: 'LCP',
      p75: 1900,
      good: 0.9,
      samples: 10,
      rating: 'good',
    });
    expect(health.vitals[1].rating).toBe('needs-improvement');
    expect(health.vitals[2]).toMatchObject({ samples: 0, p75: null, rating: null });
    expect(health.counters.map((counter) => counter.name)).toEqual([
      'socket_disconnect',
      'fleet_error.42501',
      'zz_other',
    ]);
    expect(health.counters[1]).toMatchObject({ group: 'fleet_error', detail: '42501', total: 2 });
    expect(health.longTasks).toEqual({ count: 12, totalMs: 1500, maxMs: 320 });
  });

  it('has no long tasks when none were reported', () => {
    expect(releaseHealth(ROWS, '1.0.0+aaaaaaa').longTasks).toBeNull();
  });
});

describe('formatDuration and fill', () => {
  it('formats durations and fills a template with values', () => {
    expect(formatDuration(4200, 'en')).toBe('4.2 s');
    expect(formatDuration(380, 'en')).toBe('380 ms');
    expect(fill('{0} in total, longest {1}', ['A', 'B'])).toEqual([
      'A',
      ' in total, longest ',
      'B',
    ]);
    expect(fill('no values', [])).toEqual(['no values']);
  });
});

describe('splitCounter', () => {
  it('separates the group from the detail', () => {
    expect(splitCounter('api_error.503')).toEqual({ group: 'api_error', detail: '503' });
    expect(splitCounter('js_error')).toEqual({ group: 'js_error', detail: null });
  });
});
