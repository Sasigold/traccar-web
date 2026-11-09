import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  hiddenReason,
  isWorkTime,
  localParts,
  maskPositions,
  maskReportRow,
} from '../privacy';

// 2026-11-10 is a Tuesday; Israel is UTC+2 in November.
const at = (local) => new Date(`${local}+02:00`).toISOString();
const policy = { ...DEFAULT_POLICY, hide_outside_hours: true };

describe('working hours', () => {
  it('reads the day and time in Israel', () => {
    expect(localParts(at('2026-11-10T06:30:00'))).toEqual({ day: 2, minutes: 390 });
  });

  it('is Sunday to Thursday, 07:00 to 19:00 by default', () => {
    expect(isWorkTime(policy, at('2026-11-10T07:00:00'))).toBe(true);
    expect(isWorkTime(policy, at('2026-11-10T18:59:00'))).toBe(true);
    expect(isWorkTime(policy, at('2026-11-10T19:00:00'))).toBe(false);
    expect(isWorkTime(policy, at('2026-11-10T06:59:00'))).toBe(false);
    expect(isWorkTime(policy, at('2026-11-13T10:00:00'))).toBe(false); // Friday
    expect(isWorkTime(policy, at('2026-11-14T10:00:00'))).toBe(false); // Saturday
  });

  it('keeps a night shift on the day it starts', () => {
    const night = { ...policy, work_days: [0], work_start: '22:00', work_end: '06:00' };
    expect(isWorkTime(night, at('2026-11-08T23:00:00'))).toBe(true); // Sunday night
    expect(isWorkTime(night, at('2026-11-09T05:00:00'))).toBe(true); // into Monday
    expect(isWorkTime(night, at('2026-11-09T23:00:00'))).toBe(false); // Monday night
  });
});

describe('hiding locations', () => {
  const periods = [
    {
      traccar_device_id: 1,
      started_at: at('2026-11-10T12:00:00'),
      ended_at: at('2026-11-10T13:00:00'),
    },
    { traccar_device_id: 2, started_at: at('2026-11-10T12:00:00'), ended_at: null },
  ];

  it('hides private periods even in working hours, and only for that vehicle', () => {
    const privacy = { policy: DEFAULT_POLICY, periods };
    expect(hiddenReason(privacy, 1, at('2026-11-10T12:30:00'))).toBe('private');
    expect(hiddenReason(privacy, 1, at('2026-11-10T13:00:00'))).toBeNull();
    expect(hiddenReason(privacy, 2, at('2026-11-11T09:00:00'))).toBe('private');
    expect(hiddenReason(privacy, 3, at('2026-11-10T12:30:00'))).toBeNull();
    expect(hiddenReason(privacy, 1, at('2026-11-10T22:00:00'))).toBeNull(); // policy off
  });

  it('keeps the distance of hidden positions', () => {
    const privacy = { policy, periods: [] };
    const positions = [
      { deviceId: 1, fixTime: at('2026-11-10T18:58:00'), attributes: { distance: 100 } },
      { deviceId: 1, fixTime: at('2026-11-10T19:05:00'), attributes: { distance: 250 } },
      { deviceId: 1, fixTime: at('2026-11-10T20:00:00'), attributes: { distance: 50 } },
    ];
    const result = maskPositions(positions, privacy);
    expect(result.positions).toHaveLength(1);
    expect(result.hidden).toBe(2);
    expect(result.hiddenDistance).toBe(300);
    expect(maskPositions(positions, { policy: DEFAULT_POLICY, periods: [] }).positions).toBe(
      positions,
    );
  });

  it('takes the places out of a trip in hidden time and keeps the rest', () => {
    const trip = {
      deviceId: 1,
      startTime: at('2026-11-10T18:30:00'),
      endTime: at('2026-11-10T19:30:00'),
      startAddress: 'הרצל 1',
      endLat: 32.1,
      distance: 12000,
    };
    const masked = maskReportRow(trip, { policy, periods: [] });
    expect(masked).toMatchObject({
      privacy: 'hours',
      startAddress: null,
      endLat: null,
      distance: 12000,
    });
    expect(
      maskReportRow({ ...trip, endTime: at('2026-11-10T18:45:00') }, { policy, periods: [] }),
    ).toEqual({ ...trip, endTime: at('2026-11-10T18:45:00') });
  });
});
