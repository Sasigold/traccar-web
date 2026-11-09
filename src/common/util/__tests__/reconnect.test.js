import { describe, expect, it } from 'vitest';
import { backfillRange, reconnectDelay } from '../reconnect';

describe('reconnect', () => {
  const middle = () => 0.5; // no jitter

  it('retries quickly first, then backs off up to 30 seconds', () => {
    expect(reconnectDelay(0, middle)).toBe(1000);
    expect(reconnectDelay(1, middle)).toBe(2000);
    expect(reconnectDelay(4, middle)).toBe(16000);
    expect(reconnectDelay(10, middle)).toBe(30000);
  });

  it('adds at most 20% jitter and never goes below half a second', () => {
    expect(reconnectDelay(3, () => 0)).toBe(6400);
    expect(reconnectDelay(3, () => 1)).toBe(9600);
    expect(reconnectDelay(0, () => 0)).toBe(800);
  });

  it('back-fills events only for real gaps, at most six hours back', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(backfillRange(null, now)).toBeNull();
    expect(backfillRange(now - 2000, now)).toBeNull();
    expect(backfillRange(now - 60000, now)).toEqual({
      from: '2026-11-09T11:59:00.000Z',
      to: '2026-11-09T12:00:00.000Z',
    });
    expect(backfillRange(now - 24 * 3600 * 1000, now).from).toBe('2026-11-09T06:00:00.000Z');
  });
});
