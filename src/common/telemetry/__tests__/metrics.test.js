import { describe, expect, it } from 'vitest';
import { counterName, createMetricsBuffer } from '../metrics';

describe('counterName', () => {
  it('builds safe names', () => {
    expect(counterName('fleet_error', 'PGRST301')).toBe('fleet_error.pgrst301');
    expect(counterName('traccar_error', 503)).toBe('traccar_error.503');
    expect(counterName('fleet_error', ' 42 501 ')).toBe('fleet_error.42_501');
    expect(counterName('fleet_error', '')).toBe('fleet_error');
  });
});

describe('createMetricsBuffer', () => {
  it('counts, measures and hands over a batch', () => {
    const buffer = createMetricsBuffer();
    expect(buffer.isEmpty()).toBe(true);
    buffer.count('socket_disconnect');
    buffer.count('socket_disconnect', 2);
    buffer.vital({ name: 'LCP', value: 1234.56789, rating: 'good', route: '/' });
    buffer.longTask(80);
    buffer.longTask(120.4);
    expect(buffer.isEmpty()).toBe(false);
    expect(buffer.take()).toEqual({
      counters: { socket_disconnect: 3 },
      vitals: [{ name: 'LCP', value: 1234.568, rating: 'good', route: '/' }],
      longtasks: { count: 2, total_ms: 200, max_ms: 120 },
    });
    expect(buffer.isEmpty()).toBe(true);
  });

  it('refuses bad names and values', () => {
    const buffer = createMetricsBuffer();
    buffer.count('Bad Name');
    buffer.count('x', -1);
    buffer.vital({ name: 'FID', value: 1 });
    buffer.vital({ name: 'CLS', value: Number.NaN });
    buffer.vital({ name: 'CLS', value: 0.1, rating: 'great' });
    buffer.longTask(0);
    const batch = buffer.take();
    expect(batch.counters).toEqual({});
    expect(batch.vitals).toEqual([{ name: 'CLS', value: 0.1, rating: null, route: '/' }]);
    expect(batch.longtasks.count).toBe(0);
  });

  it('stays within its limits', () => {
    const buffer = createMetricsBuffer({ maxVitals: 2, maxCounters: 2 });
    ['a', 'b', 'c'].forEach((name) => buffer.count(name));
    buffer.count('a');
    [1, 2, 3].forEach((value) => buffer.vital({ name: 'INP', value }));
    const batch = buffer.take();
    expect(batch.counters).toEqual({ a: 2, b: 1 });
    expect(batch.vitals).toHaveLength(2);
  });

  it('takes a batch back when it could not be sent', () => {
    const buffer = createMetricsBuffer();
    buffer.count('token_failure');
    buffer.longTask(60);
    const batch = buffer.take();
    buffer.count('token_failure');
    buffer.restore(batch);
    expect(buffer.take()).toMatchObject({
      counters: { token_failure: 2 },
      longtasks: { count: 1, total_ms: 60, max_ms: 60 },
    });
  });
});
