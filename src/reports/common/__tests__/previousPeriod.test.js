import { describe, expect, it } from 'vitest';
import { changeHint } from '../previousPeriod';

const t = (key) => ({ reportChangeShort: '{0} מהתקופה הקודמת' })[key];

describe('the change line under a tile (REP-09)', () => {
  it('puts the figure first, and says nothing without a period before', () => {
    expect(changeHint(t, 12, 10)).toBe('▲ 20% מהתקופה הקודמת');
    expect(changeHint(t, 5, 10)).toBe('▼ 50% מהתקופה הקודמת');
    expect(changeHint(t, 5, null)).toBeUndefined();
    expect(changeHint(t, 5, 0)).toBeUndefined();
  });
});
