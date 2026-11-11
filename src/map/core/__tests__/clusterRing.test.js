import { describe, expect, it } from 'vitest';
import { parseRing, ringImageExpression } from '../clusterRing';

describe('the split cluster ring (LIV-29)', () => {
  it('names the image after the shares, in the theme', () => {
    const expression = ringImageExpression('dark');
    expect(expression[0]).toBe('concat');
    expect(expression[1]).toBe('vf-ring-dark-');
  });

  it('splits the ring in turn order: online, offline, the rest', () => {
    expect(parseRing('vf-ring-light-4-2')).toEqual({
      mode: 'light',
      parts: [
        { status: 'online', from: 0, to: 0.5 },
        { status: 'offline', from: 0.5, to: 0.75 },
        { status: 'other', from: 0.75, to: 1 },
      ],
    });
    expect(parseRing('vf-ring-dark-8-0').parts).toEqual([{ status: 'online', from: 0, to: 1 }]);
    expect(parseRing('something-else')).toBeNull();
  });
});
