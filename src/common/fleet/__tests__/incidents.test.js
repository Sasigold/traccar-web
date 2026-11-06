import { describe, expect, it } from 'vitest';
import { fromLocalInput, nearestPosition, toLocalInput } from '../incidents';

describe('incidents', () => {
  const at = (iso, id) => ({ id, fixTime: iso });

  it('picks the closest position within ten minutes', () => {
    const positions = [
      at('2026-11-06T10:00:00Z', 1),
      at('2026-11-06T10:07:00Z', 2),
      at('2026-11-06T10:30:00Z', 3),
    ];
    expect(nearestPosition(positions, Date.parse('2026-11-06T10:05:00Z')).id).toBe(2);
    expect(nearestPosition(positions, Date.parse('2026-11-06T10:20:00Z')).id).toBe(3);
    expect(nearestPosition(positions, Date.parse('2026-11-06T11:00:00Z'))).toBeNull();
    expect(nearestPosition([], Date.now())).toBeNull();
  });

  it('round-trips datetime-local values', () => {
    const value = toLocalInput('2026-11-06T10:05:00Z');
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromLocalInput(value)).toBe('2026-11-06T10:05:00.000Z');
    expect(fromLocalInput('')).toBeNull();
  });
});
