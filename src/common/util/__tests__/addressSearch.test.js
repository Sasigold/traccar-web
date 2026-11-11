import { describe, expect, it, vi } from 'vitest';
import { formatAddress, geocodeAddress, searchStreets, splitHouseNumber } from '../addressSearch';

describe('Hebrew addresses (ISR-10)', () => {
  it('takes the house number out of what was typed', () => {
    expect(splitHouseNumber('הרצל 12 רמת גן')).toEqual({ text: 'הרצל רמת גן', number: '12' });
    expect(splitHouseNumber('בן יהודה 7א')).toEqual({ text: 'בן יהודה', number: '7א' });
    expect(splitHouseNumber('דיזנגוף')).toEqual({ text: 'דיזנגוף', number: '' });
  });

  it('writes an address the usual way', () => {
    expect(formatAddress({ street: 'הרצל', number: '12', city: 'רמת גן' })).toBe('הרצל 12, רמת גן');
    expect(formatAddress({ street: 'הרצל', city: 'אופקים' })).toBe('הרצל, אופקים');
  });

  it('suggests official street names, and asks once per text', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: { records: [{ שם_רחוב: 'שד הרצל ', שם_ישוב: 'אופקים' }] },
      }),
    }));
    const first = await searchStreets('הרצל 3', { fetcher });
    expect(first).toEqual([{ street: 'שד הרצל', city: 'אופקים', number: '3' }]);
    await searchStreets('הרצל 5', { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('q=%D7%94%D7%A8%D7%A6%D7%9C');
  });

  it('gets the coordinates of a chosen address from the geocoder', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => [{ lat: '32.08', lon: '34.81' }],
    }));
    const point = await geocodeAddress('הרצל 12, רמת גן', {
      fetcher,
      url: 'https://geo.example/search',
    });
    expect(point).toEqual({ latitude: 32.08, longitude: 34.81 });
    expect(String(fetcher.mock.calls[0][0])).toMatch(/^https:\/\/geo\.example\/search\?q=/);
  });
});
