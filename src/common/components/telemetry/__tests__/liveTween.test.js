import { describe, expect, it } from 'vitest';
import { LIVE_GAP, liveTween } from '../liveTween';

describe('liveTween', () => {
  it('glides streamed readings at a constant pace across the gap', () => {
    const { duration, ease } = liveTween(1000);
    expect(duration).toBeCloseTo(1050);
    expect(ease(0.5)).toBe(0.5);
  });

  it('keeps very fast streams visible', () => {
    expect(liveTween(50).duration).toBe(250);
  });

  it('eases out sparse readings and the first change', () => {
    for (const gap of [null, LIVE_GAP + 1, 10000]) {
      const { duration, ease } = liveTween(gap);
      expect(duration).toBe(700);
      expect(ease(0.5)).toBeGreaterThan(0.5);
      expect(ease(1)).toBe(1);
    }
  });
});
