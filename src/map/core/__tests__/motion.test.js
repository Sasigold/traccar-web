import { describe, expect, it } from 'vitest';
import {
  LIVE_MAX_DURATION,
  LIVE_MIN_DURATION,
  REPLAY_MAX_SEGMENT,
  REPLAY_MIN_SEGMENT,
  distanceMeters,
  interpolateCoordinates,
  lerpAngle,
  liveTransitionDuration,
  replaySegmentDuration,
} from '../motion';

const fix = (latitude, longitude, seconds, course = 0) => ({
  latitude,
  longitude,
  course,
  fixTime: new Date(Date.UTC(2026, 0, 1, 12, 0, seconds)).toISOString(),
});

describe('lerpAngle', () => {
  it('takes the short way across north', () => {
    expect(lerpAngle(350, 10, 0.5)).toBe(0);
    expect(lerpAngle(10, 350, 0.5)).toBe(0);
  });

  it('interpolates plainly when no wrap is needed', () => {
    expect(lerpAngle(90, 180, 0.5)).toBe(135);
  });

  it('normalizes the result into [0, 360)', () => {
    expect(lerpAngle(350, 10, 1)).toBe(10);
    expect(lerpAngle(10, 350, 1)).toBe(350);
  });
});

describe('interpolateCoordinates', () => {
  it('returns the midpoint and heading half way', () => {
    const result = interpolateCoordinates(fix(32, 34.7, 0, 0), fix(32.2, 34.9, 10, 90), 0.5);
    expect(result).toEqual({ latitude: 32.1, longitude: 34.8, course: 45 });
  });

  it('clamps progress to the segment', () => {
    const from = fix(32, 34.7, 0);
    const to = fix(32.2, 34.9, 10);
    expect(interpolateCoordinates(from, to, -1).latitude).toBe(32);
    expect(interpolateCoordinates(from, to, 2).latitude).toBe(32.2);
  });

  it('treats a missing course as north', () => {
    const result = interpolateCoordinates({ latitude: 0, longitude: 0 }, fix(0, 0, 0, 90), 1);
    expect(result.course).toBe(90);
  });
});

describe('distanceMeters', () => {
  it('measures one degree of latitude as about 111 km', () => {
    expect(distanceMeters(fix(32, 34.8, 0), fix(33, 34.8, 0))).toBeCloseTo(111195, -2);
  });
});

describe('liveTransitionDuration', () => {
  it('glides for as long as the device took between fixes', () => {
    expect(liveTransitionDuration(fix(32, 34.8, 0), fix(32.001, 34.801, 10))).toBe(10000);
  });

  it('clamps the glide to the configured range', () => {
    expect(liveTransitionDuration(fix(32, 34.8, 0), fix(32.0001, 34.8, 0.1))).toBe(
      LIVE_MIN_DURATION,
    );
    expect(liveTransitionDuration(fix(32, 34.8, 0), fix(32.01, 34.8, 60))).toBe(LIVE_MAX_DURATION);
  });

  it('teleports when the vehicle did not move', () => {
    expect(liveTransitionDuration(fix(32, 34.8, 0), fix(32, 34.8, 10))).toBe(0);
  });

  it('teleports across a long jump or a long silence', () => {
    expect(liveTransitionDuration(fix(32, 34.8, 0), fix(32.1, 34.8, 10))).toBe(0);
    expect(liveTransitionDuration(fix(32, 34.8, 0), fix(32.001, 34.8, 600))).toBe(0);
  });

  it('teleports when there is nothing to come from', () => {
    expect(liveTransitionDuration(undefined, fix(32, 34.8, 0))).toBe(0);
  });
});

describe('replaySegmentDuration', () => {
  it('compresses the real interval between points', () => {
    expect(replaySegmentDuration(fix(32, 34.8, 0), fix(32.001, 34.8, 10))).toBe(500);
  });

  it('keeps dense and sparse tracks within the playable range', () => {
    expect(replaySegmentDuration(fix(32, 34.8, 0), fix(32.001, 34.8, 1))).toBe(REPLAY_MIN_SEGMENT);
    expect(replaySegmentDuration(fix(32, 34.8, 0), fix(32.001, 34.8, 3600))).toBe(
      REPLAY_MAX_SEGMENT,
    );
  });

  it('copes with a missing fix time', () => {
    expect(replaySegmentDuration({ latitude: 0, longitude: 0 }, fix(0, 0, 0))).toBe(
      REPLAY_MIN_SEGMENT,
    );
  });
});
