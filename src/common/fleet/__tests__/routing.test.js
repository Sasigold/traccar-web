import { describe, expect, it } from 'vitest';
import { planRoute, walkRoute } from '../routing';

// OPS-03: stops along a line east of the start, given out of order.
const start = { latitude: 32, longitude: 34.8 };
const stop = (id, east, windowEnd) => ({
  id,
  latitude: 32,
  longitude: 34.8 + east * 0.01,
  windowEnd,
});
const t0 = Date.parse('2026-11-10T08:00:00Z');
const ids = (route) => route.legs.map((leg) => leg.stop.id);

describe('planRoute', () => {
  it('visits stops along the way instead of zigzagging', () => {
    const route = planRoute(start, [stop('c', 3), stop('a', 1), stop('d', 4), stop('b', 2)], {
      startTime: t0,
    });
    expect(ids(route)).toEqual(['a', 'b', 'c', 'd']);
    expect(route.lateMinutes).toBe(0);
  });

  it('serves a stop with an early window first, even if it is further', () => {
    const route = planRoute(start, [stop('near', 1), stop('urgent', 10, t0 + 20 * 60000)], {
      startTime: t0,
    });
    expect(ids(route)[0]).toBe('urgent');
  });

  it('reports the arrival times and the lateness of an order', () => {
    const walk = walkRoute(start, [stop('a', 1, t0)], { startTime: t0, speedKmh: 60 });
    expect(walk.legs[0].arrival).toBeGreaterThan(t0);
    expect(walk.legs[0].lateMinutes).toBeGreaterThan(0);
    expect(walk.km).toBeGreaterThan(0);
  });
});
