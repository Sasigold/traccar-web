import { describe, expect, it } from 'vitest';
import {
  formatAlarm,
  formatCoordinate,
  formatCourse,
  formatDistance,
  formatNumericHours,
  formatSpeed,
  formatVolume,
} from '../formatter';

const t = (key) => key;

describe('unit formatting', () => {
  it('shows speed as a whole number in km/h by default', () => {
    expect(formatSpeed(13.61, undefined, t)).toBe('25 sharedKmh');
    expect(formatSpeed(13.61, 'kn', t)).toBe('14 sharedKn');
  });

  it('shows distance with one decimal', () => {
    expect(formatDistance(12345, 'km', t)).toBe('12.3 sharedKm');
  });

  it('shows volume with one decimal', () => {
    expect(formatVolume(42.04, 'ltr', t)).toBe('42.0 sharedLiterAbbreviation');
  });

  it('formats hours and minutes', () => {
    expect(formatNumericHours(3 * 3600000 + 25 * 60000, t)).toBe(
      '3 sharedHourAbbreviation 25 sharedMinuteAbbreviation',
    );
  });
});

describe('course', () => {
  it('maps headings to the nearest of eight arrows', () => {
    expect(formatCourse(0)).toBe('↑');
    expect(formatCourse(90)).toBe('→');
    expect(formatCourse(350)).toBe('↑');
    expect(formatCourse(-90)).toBe('←');
  });
});

describe('coordinates', () => {
  it('formats decimal, ddm and dms', () => {
    expect(formatCoordinate('latitude', 32.0853, 'dd')).toBe('32.08530°');
    expect(formatCoordinate('latitude', 32.0853, 'ddm')).toBe("32° 5.118' N");
    expect(formatCoordinate('longitude', -34.7818, 'dms')).toBe('34° 46\' 54" W');
  });
});

describe('alarms', () => {
  it('translates each alarm in a comma list', () => {
    expect(formatAlarm('sos,overspeed', t)).toBe('alarmSos, alarmOverspeed');
    expect(formatAlarm(null, t)).toBe('');
  });
});
