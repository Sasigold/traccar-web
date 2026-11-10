import { describe, expect, it } from 'vitest';
import { wazeUrl } from '../waze';

describe('Waze links (ISR-14)', () => {
  it('navigates to coordinates when there are any', () => {
    expect(wazeUrl({ latitude: 32.08, longitude: 34.78, address: 'דיזנגוף 1' })).toBe(
      'https://waze.com/ul?ll=32.08,34.78&navigate=yes',
    );
    expect(wazeUrl({ latitude: '31.5', longitude: '35' })).toBe(
      'https://waze.com/ul?ll=31.5,35&navigate=yes',
    );
  });

  it('falls back to the address, encoded', () => {
    expect(wazeUrl({ latitude: '', longitude: '', address: ' הרצל 5, חיפה ' })).toBe(
      `https://waze.com/ul?q=${encodeURIComponent('הרצל 5, חיפה')}&navigate=yes`,
    );
    expect(wazeUrl({ latitude: 200, longitude: 34, address: 'x' })).toContain('q=x');
  });

  it('gives nothing without a place', () => {
    expect(wazeUrl()).toBeNull();
    expect(wazeUrl({ address: '  ' })).toBeNull();
    expect(wazeUrl({ latitude: null, longitude: 34 })).toBeNull();
  });
});
