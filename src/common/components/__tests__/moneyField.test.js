import { describe, expect, it } from 'vitest';
import { cleanAmount } from '../MoneyField';

describe('amounts (ADM-24)', () => {
  it('keep digits and one decimal point', () => {
    expect(cleanAmount('1,250.50')).toBe('1250.50');
    expect(cleanAmount('12e3')).toBe('123');
    expect(cleanAmount('₪ 99.999')).toBe('99.99');
    expect(cleanAmount('1.2.3')).toBe('1.23');
    expect(cleanAmount('')).toBe('');
  });
});
