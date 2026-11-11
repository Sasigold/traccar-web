import { describe, expect, it } from 'vitest';
import { mergeMotionEvents } from '../MotionController';

const at = (id, iso, type = 'deviceMoving') => ({ id, deviceId: 1, type, eventTime: iso });

describe('mergeMotionEvents (PRF-05)', () => {
  it('adds what is new, once, in time order, and forgets what is older than the window', () => {
    const previous = [
      at(1, '2026-11-10T07:00:00Z'),
      at(2, '2026-11-10T08:00:00Z', 'deviceStopped'),
    ];
    const incoming = [
      at(2, '2026-11-10T08:00:00Z', 'deviceStopped'),
      at(3, '2026-11-10T09:00:00Z'),
    ];
    const merged = mergeMotionEvents(previous, incoming, Date.parse('2026-11-10T07:30:00Z'));
    expect(merged.map((event) => event.id)).toEqual([2, 3]);
  });
});
