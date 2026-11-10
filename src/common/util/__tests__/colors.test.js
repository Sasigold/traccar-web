import { describe, expect, it } from 'vitest';
import getSpeedColor, { SPEED_RAMP, overspeedColor } from '../colors';
import { status } from '../../theme/tokens';

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

describe('speeding bands on the route (SAF-06)', () => {
  it('marks a little over the limit as a warning and more as an error', () => {
    const limit = 90 / 1.852;
    expect(getSpeedColor(95 / 1.852, 0, 100, { limit })).toBe(status.light.warning);
    expect(getSpeedColor(105 / 1.852, 0, 100, { limit })).toBe(status.light.error);
    expect(getSpeedColor(85 / 1.852, 0, 100, { limit })).not.toBe(status.light.warning);
  });
});
