import { describe, expect, it } from 'vitest';
import { coldChainOf } from '../coldChain';

const at = (minutes, temp1, temp2) => ({
  fixTime: new Date(Date.UTC(2026, 10, 11, 8, minutes)).toISOString(),
  attributes: { temp1, ...(temp2 == null ? {} : { temp2 }), deviceTemp: 40 },
});

describe('coldChainOf', () => {
  it('counts the excursions and the time out of range', () => {
    const result = coldChainOf(
      [at(0, 3), at(10, 9), at(20, 10), at(30, 4), at(40, 4, -1), at(50, 4)],
      { temp_min: 0, temp_max: 8 },
    );
    // 10-30 too warm, 40-50 a second sensor too cold: two excursions, 30 minutes.
    expect(result).toEqual({ readings: 6, excursions: 2, outMs: 30 * 60000, min: -1, max: 10 });
  });

  it('is quiet without temperatures', () => {
    expect(coldChainOf([{ fixTime: at(0).fixTime, attributes: {} }], { temp_max: 8 })).toEqual({
      readings: 0,
      excursions: 0,
      outMs: 0,
      min: null,
      max: null,
    });
  });
});
