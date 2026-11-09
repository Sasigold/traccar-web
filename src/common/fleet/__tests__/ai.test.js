import { describe, expect, it } from 'vitest';
import { aiErrorKey, vehiclesWithCode } from '../ai';

describe('AI in the browser', () => {
  it('names the reason in words', () => {
    expect(aiErrorKey({ code: 'daily_limit' })).toBe('aiErrorLimit');
    expect(aiErrorKey({ code: 'ai_disabled' })).toBe('aiErrorDisabled');
    expect(aiErrorKey(new Error('x'))).toBe('aiErrorGeneral');
  });

  it('counts the other vehicles that report a code now (AI-03)', () => {
    const positions = {
      1: { deviceId: 1, attributes: { dtcs: 'P0420 P0171' } },
      2: { deviceId: 2, attributes: { dtcs: 'p0420' } },
      3: { deviceId: 3, attributes: { faults: 'P0300,P0420' } },
      4: { deviceId: 4, attributes: {} },
    };
    expect(vehiclesWithCode(positions, 'P0420', 1)).toBe(2);
    expect(vehiclesWithCode(positions, 'P0171', 1)).toBe(0);
  });
});
