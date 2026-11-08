import { describe, expect, it } from 'vitest';
import { uncoveredOffset } from '../statusCardArea';

const rect = (top, bottom, left = 0, right = 400) => ({ top, bottom, left, right });
const map = rect(100, 900);

describe('uncoveredOffset', () => {
  it('is 0 without a card or when the card is off the map', () => {
    expect(uncoveredOffset(map, null)).toBe(0);
    expect(uncoveredOffset(map, rect(900, 1000))).toBe(0);
    expect(uncoveredOffset(map, rect(200, 300, 500, 700))).toBe(0);
  });

  it('centers the vehicle above a card at the bottom', () => {
    // Uncovered band 100..500, middle 300; map middle 500.
    expect(uncoveredOffset(map, rect(500, 880))).toBe(-200);
  });

  it('moves the vehicle below a card dragged up', () => {
    // Uncovered band 400..900, middle 650.
    expect(uncoveredOffset(map, rect(120, 400))).toBe(150);
  });
});
