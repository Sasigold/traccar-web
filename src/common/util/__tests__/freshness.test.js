import { describe, expect, it } from 'vitest';
import { formatUpdated, isLive } from '../freshness';
import { formatTime } from '../formatter';

const now = new Date('2026-11-09T12:00:00Z').getTime();

describe('live and last update (LIV-18)', () => {
  it('is live only within the last minute', () => {
    expect(isLive(new Date(now - 30 * 1000).toISOString(), now)).toBe(true);
    expect(isLive(new Date(now - 61 * 1000).toISOString(), now)).toBe(false);
    expect(isLive(null, now)).toBe(false);
  });

  it('tolerates a device clock slightly ahead', () => {
    expect(isLive(new Date(now + 5 * 1000).toISOString(), now)).toBe(true);
    expect(isLive(new Date(now + 10 * 60 * 1000).toISOString(), now)).toBe(false);
  });

  it('shows only the time today, and the date on another day', () => {
    const today = new Date(now - 60 * 60 * 1000).toISOString();
    const earlier = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatUpdated(today, now)).toBe(formatTime(today, 'time'));
    expect(formatUpdated(earlier, now)).toBe(formatTime(earlier, 'minutes'));
    expect(formatUpdated(null, now)).toBe('');
  });
});
