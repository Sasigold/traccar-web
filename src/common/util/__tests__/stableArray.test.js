import { describe, expect, it } from 'vitest';
import { sameItems } from '../stableArray';

describe('sameItems', () => {
  const a = { id: 1 };
  const b = { id: 2 };
  it('compares by identity, in order', () => {
    expect(sameItems([a, b], [a, b])).toBe(true);
    expect(sameItems([a, b], [b, a])).toBe(false);
    expect(sameItems([a], [{ id: 1 }])).toBe(false);
    expect(sameItems([a], [a, b])).toBe(false);
    expect(sameItems([], [])).toBe(true);
    expect(sameItems(null, [])).toBe(false);
  });
});
