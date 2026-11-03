import { describe, expect, it } from 'vitest';
import {
  distanceFromMeters,
  distanceToMeters,
  speedFromKnots,
  speedToKnots,
  speedUnitString,
  volumeFromLiters,
  volumeToLiters,
  altitudeFromMeters,
} from '../converter';

const t = (key) => key;

describe('speed', () => {
  it('defaults to km/h when no unit is set', () => {
    expect(speedFromKnots(10, undefined)).toBeCloseTo(18.52);
    expect(speedUnitString(undefined, t)).toBe('sharedKmh');
  });

  it('converts each unit from knots', () => {
    expect(speedFromKnots(10, 'kn')).toBe(10);
    expect(speedFromKnots(10, 'kmh')).toBeCloseTo(18.52);
    expect(speedFromKnots(10, 'mph')).toBeCloseTo(11.5078, 3);
  });

  it('round-trips through knots', () => {
    ['kn', 'kmh', 'mph', undefined].forEach((unit) => {
      expect(speedFromKnots(speedToKnots(90, unit), unit)).toBeCloseTo(90);
    });
  });
});

describe('distance', () => {
  it('defaults to kilometers', () => {
    expect(distanceFromMeters(1500, undefined)).toBe(1.5);
  });

  it('round-trips miles and nautical miles', () => {
    ['km', 'mi', 'nmi'].forEach((unit) => {
      expect(distanceToMeters(distanceFromMeters(12345, unit), unit)).toBeCloseTo(12345);
    });
  });
});

describe('volume and altitude', () => {
  it('converts gallons and keeps liters', () => {
    expect(volumeFromLiters(10, 'ltr')).toBe(10);
    expect(volumeToLiters(1, 'usGal')).toBeCloseTo(3.7854, 3);
  });

  it('converts meters to feet', () => {
    expect(altitudeFromMeters(100, 'ft')).toBeCloseTo(328.084, 2);
  });
});
