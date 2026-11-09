import { describe, expect, it } from 'vitest';
import getSpeedColor, { SPEED_RAMP, overspeedColor } from '../colors';

describe('route speed colors', () => {
  it('steps through the brand ramp from slow to fast', () => {
    expect(getSpeedColor(0, 0, 100)).toBe(SPEED_RAMP.light[0]);
    expect(getSpeedColor(100, 0, 100)).toBe(SPEED_RAMP.light[4]);
    expect(getSpeedColor(50, 0, 100)).toBe(SPEED_RAMP.light[2]);
    expect(getSpeedColor(100, 0, 100, { dark: true })).toBe(SPEED_RAMP.dark[4]);
  });

  it('marks speeding in the error color', () => {
    expect(getSpeedColor(60, 0, 100, { limit: 50 })).toBe(overspeedColor(false));
    expect(getSpeedColor(40, 0, 100, { limit: 50 })).toBe(SPEED_RAMP.light[2]);
  });

  it('copes with a route at one speed', () => {
    expect(getSpeedColor(30, 30, 30)).toBe(SPEED_RAMP.light[0]);
  });
});
