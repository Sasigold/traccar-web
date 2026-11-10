import { describe, expect, it } from 'vitest';
import { monthlyBenefit, poolBenefit, propulsionOf } from '../benefit';

// ISR-05: the monthly taxable benefit of a company car (2026 values, to confirm yearly).
describe('the taxable benefit of a company car', () => {
  it('is 2.48% of the list price, capped, less the electric or hybrid reduction', () => {
    expect(monthlyBenefit(200000)).toBe(4960);
    expect(monthlyBenefit(900000)).toBe(Math.round(596860 * 0.0248));
    expect(monthlyBenefit(200000, 'electric')).toBe(4960 - 1350);
    expect(monthlyBenefit(200000, propulsionOf('hybrid'))).toBe(4960 - 560);
    expect(monthlyBenefit('')).toBeNull();
  });

  it('for a pool car, only the nights it went home', () => {
    expect(poolBenefit(4960, 10, 31)).toBe(1600);
    expect(poolBenefit(null, 10, 31)).toBeNull();
  });
});
