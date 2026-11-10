import { describe, expect, it } from 'vitest';
import { accidentWindow } from '../accident';

// SAF-04: the minute either side of a collision, for the insurer.
describe('the accident window', () => {
  it('keeps a minute either side, with the speed before and the hardest braking', () => {
    const at = '2026-11-09T10:00:00Z';
    const t = (s) => new Date(Date.parse(at) + s * 1000).toISOString();
    const positions = [
      { fixTime: t(-90), speed: 40 },
      { fixTime: t(-10), speed: 43.2 },
      { fixTime: t(0), speed: 10.8 },
      { fixTime: t(5), speed: 0 },
      { fixTime: t(120), speed: 0 },
    ];
    const result = accidentWindow(positions, at);
    expect(result.rows.map((row) => row.offset)).toEqual([-10, 0, 5]);
    expect(result.maxSpeedBefore).toBe(80);
    expect(result.impact.offset).toBe(0);
    expect(result.maxDeceleration).toBeGreaterThan(5);
  });

  it('is empty when the device sent nothing around it', () => {
    expect(accidentWindow([], '2026-11-09T10:00:00Z')).toMatchObject({ rows: [], impact: null });
  });
});
