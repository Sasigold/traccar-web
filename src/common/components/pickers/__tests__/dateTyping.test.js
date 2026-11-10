import { describe, expect, it } from 'vitest';
import { addToDate, dateOrder, maskDate, parseTypedDate } from '../dateTyping';

describe('typed dates (ADM-24)', () => {
  it('puts the separators in while typing', () => {
    expect(maskDate('1')).toBe('1');
    expect(maskDate('150')).toBe('15/0');
    expect(maskDate('15032027')).toBe('15/03/2027');
    expect(maskDate('15/03/20271')).toBe('15/03/2027');
    expect(maskDate('ab')).toBe('');
  });

  it('reads the order of the locale', () => {
    expect(dateOrder('DD/MM/YYYY')).toBe('DMY');
    expect(dateOrder('MM/DD/YYYY')).toBe('MDY');
    expect(dateOrder('DD.MM.YYYY')).toBe('DMY');
  });

  it('accepts only real days', () => {
    expect(parseTypedDate('15/03/2027')).toBe('2027-03-15');
    expect(parseTypedDate('03/15/2027', 'MDY')).toBe('2027-03-15');
    expect(parseTypedDate('5.3.2027')).toBe('2027-03-05');
    expect(parseTypedDate('31/02/2027')).toBeNull();
    expect(parseTypedDate('15/03/27')).toBeNull();
    expect(parseTypedDate('')).toBeNull();
  });

  it('renews by a year or six months', () => {
    expect(addToDate('2026-11-30', 1, 'year')).toBe('2027-11-30');
    expect(addToDate('2026-08-31', 6, 'month')).toBe('2027-02-28');
  });
});
