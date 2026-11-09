import { describe, expect, it } from 'vitest';
import { maskValue } from '../MaskedValue';

describe('masked identifiers (SEC-16)', () => {
  it('shows only the last digits', () => {
    expect(maskValue('123456782')).toBe('•••••6782');
    expect(maskValue('4580123412341234')).toBe('••••••1234');
    expect(maskValue('123')).toBe('123');
    expect(maskValue(null)).toBe('');
  });
});
