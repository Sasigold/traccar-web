import { describe, expect, it } from 'vitest';
import { trailPoints } from '../trail';

const now = Date.parse('2026-11-10T12:00:00Z');
const at = (minutesAgo, longitude) => ({
  fixTime: new Date(now - minutesAgo * 60000).toISOString(),
  longitude,
  latitude: 32,
});

describe('the selected vehicle trail (LIV-12)', () => {
  it('keeps the last ten minutes in order, without repeats', () => {
    const points = trailPoints([at(2, 3), at(12, 1), at(8, 2), at(1, 3), at(0, 4)], now);
    expect(points.map((point) => point.longitude)).toEqual([2, 3, 4]);
  });
});
