import { describe, expect, it } from 'vitest';
import { momentOf, positionsAt, rewindWindow } from '../rewind';

const at = (iso) => Date.parse(iso);

describe('fleet rewind (LIV-26)', () => {
  it('asks for a short window before the moment', () => {
    expect(rewindWindow(at('2026-11-10T10:00:00Z'))).toEqual({
      from: '2026-11-10T09:30:00.000Z',
      to: '2026-11-10T10:00:00.000Z',
    });
  });

  it('places each vehicle at its last position up to the moment', () => {
    const history = [
      { deviceId: 1, fixTime: '2026-11-10T09:40:00Z', latitude: 1 },
      { deviceId: 1, fixTime: '2026-11-10T09:58:00Z', latitude: 2 },
      { deviceId: 1, fixTime: '2026-11-10T10:05:00Z', latitude: 3 },
      { deviceId: 2, fixTime: '2026-11-10T09:31:00Z', latitude: 9 },
    ];
    const result = positionsAt(history, at('2026-11-10T10:00:00Z'));
    expect(result.map((p) => [p.deviceId, p.latitude])).toEqual([
      [1, 2],
      [2, 9],
    ]);
  });

  it('rounds the moment to five minutes', () => {
    expect(new Date(momentOf(60, at('2026-11-10T10:07:30Z'))).toISOString()).toBe(
      '2026-11-10T09:05:00.000Z',
    );
  });
});
