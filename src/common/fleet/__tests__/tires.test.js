import { describe, expect, it } from 'vitest';
import { slowLeak, tireCostPerKm, tirePositions, treadStatus } from '../tires';

const hours = (h) => Date.UTC(2026, 10, 1) + h * 3600 * 1000;

describe('tires (OPS-07)', () => {
  it('rates tread depth against the legal minimum', () => {
    expect(treadStatus(1.2)).toBe('error');
    expect(treadStatus(2.4)).toBe('warning');
    expect(treadStatus(6)).toBe('ok');
    expect(treadStatus(null)).toBe('none');
  });

  it('finds a slow leak since the last refill', () => {
    const before = [0, 12, 24].map((h) => ({ time: hours(h), value: 2.1 - h * 0.01 }));
    const refill = [36, 48, 60, 72, 84, 96, 108].map((h, i) => ({
      time: hours(h),
      value: 2.4 - i * 0.06,
    }));
    const leak = slowLeak([...refill, ...before]);
    expect(leak.perDay).toBeCloseTo(0.12, 2);
    expect(leak.since).toBe(new Date(hours(36)).toISOString());
    expect(leak.daysToLow).toBeGreaterThan(0);
  });

  it('ignores a steady tire, noise and short stretches', () => {
    const steady = Array.from({ length: 10 }, (_, i) => ({
      time: hours(i * 12),
      value: 2.3 + (i % 2 ? 0.02 : -0.02),
    }));
    expect(slowLeak(steady)).toBeNull();
    const short = Array.from({ length: 8 }, (_, i) => ({ time: hours(i), value: 2.4 - i * 0.05 }));
    expect(slowLeak(short)).toBeNull();
  });

  it('costs per km until removed or until now', () => {
    expect(tireCostPerKm({ cost: 600, installed_odometer: 10000 }, 40000)).toBeCloseTo(0.02);
    expect(
      tireCostPerKm({ cost: 600, installed_odometer: 10000, removed_odometer: 70000 }, 90000),
    ).toBeCloseTo(0.01);
    expect(tireCostPerKm({ cost: null, installed_odometer: 0 }, 1000)).toBeNull();
  });

  it('lists positions by axles', () => {
    expect(tirePositions()).toEqual(['fl', 'fr', 'rl', 'rr']);
    expect(tirePositions(3)).toEqual(['fl', 'fr', 'l2', 'r2', 'rl', 'rr']);
  });
});
