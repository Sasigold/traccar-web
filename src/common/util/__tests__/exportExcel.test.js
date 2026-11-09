import { describe, expect, it } from 'vitest';
import { exportFileName, numericColumn, sheetName, splitNumber } from '../exportExcel';

describe('numbers in exported cells', () => {
  it('reads a number and its unit', () => {
    expect(splitNumber('12.3 ק"מ')).toEqual({ number: 12.3, unit: 'ק"מ' });
    expect(splitNumber('12,000 ק"מ')).toEqual({ number: 12000, unit: 'ק"מ' });
    expect(splitNumber('45%')).toEqual({ number: 45, unit: '%' });
    expect(splitNumber('7')).toEqual({ number: 7, unit: '' });
    expect(splitNumber(3.5)).toEqual({ number: 3.5, unit: '' });
  });

  it('leaves identifiers, phones, times and text alone', () => {
    [
      '0501234567',
      '860000123456',
      '12-345-67',
      '2:05 ש׳',
      '09.11.2026',
      'Delivery Van',
      '',
    ].forEach((value) => expect(splitNumber(value), value).toBeNull());
  });

  it('makes a column numeric only when every value shares the unit', () => {
    expect(numericColumn(['1 ק"מ', '2.5 ק"מ', null])).toEqual({ unit: 'ק"מ', integer: false });
    expect(numericColumn(['1 ק"מ', '2 מ׳'])).toBeNull();
    expect(numericColumn(['3', 'n/a'])).toBeNull();
    expect(numericColumn([null, ''])).toBeNull();
  });
});

describe('sheet and file names', () => {
  it('cleans names Excel refuses and keeps them apart', () => {
    const used = new Set();
    expect(sheetName('משאית 12/3', used)).toBe('משאית 12 3');
    expect(sheetName('משאית 12/3', used)).toBe('משאית 12 3 (2)');
    expect(sheetName('a:b*c?[d]', used)).toBe('a b c d');
    expect(sheetName('x'.repeat(40), used)).toHaveLength(31);
    expect(sheetName('', used)).toBe('Sheet');
  });

  it('names the file after the report and the period', () => {
    expect(
      exportFileName('trips.xlsx', { from: '2026-11-01T00:00:00Z', to: '2026-11-07T12:00:00Z' }),
    ).toBe('viper-fleet_trips_2026-11-01_2026-11-07.xlsx');
    expect(exportFileName('devices.xlsx', {})).toMatch(
      /^viper-fleet_devices_\d{4}-\d\d-\d\d\.xlsx$/,
    );
  });
});
