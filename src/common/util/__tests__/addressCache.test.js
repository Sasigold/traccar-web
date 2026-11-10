import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_PARALLEL,
  cachedAddress,
  clearAddressCache,
  geofenceAt,
  requestAddress,
  subscribeAddress,
  addressKey,
} from '../addressCache';

// REP-13: addresses in reports: three requests at a time, once per point.
beforeEach(() => clearAddressCache());

describe('the address cache', () => {
  it('asks the geocoder at most three at a time, and once per point', async () => {
    let active = 0;
    let peak = 0;
    const fetchAddress = vi.fn(async (lat) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return `כתובת ${lat}`;
    });
    const points = Array.from({ length: 8 }, (_, i) => [32 + i / 100, 34.8]);
    const results = await Promise.all([
      ...points.map(([lat, lon]) => requestAddress(lat, lon, fetchAddress)),
      requestAddress(32, 34.8, fetchAddress),
    ]);
    expect(peak).toBeLessThanOrEqual(MAX_PARALLEL);
    expect(fetchAddress).toHaveBeenCalledTimes(8);
    expect(results[0]).toBe('כתובת 32');
    expect(cachedAddress(32, 34.8)).toBe('כתובת 32');
    await requestAddress(32, 34.8, fetchAddress);
    expect(fetchAddress).toHaveBeenCalledTimes(8);
  });

  it('tells every row showing that point', async () => {
    const listener = vi.fn();
    subscribeAddress(addressKey(31.5, 35), listener);
    await requestAddress(31.5, 35, async () => 'ירושלים');
    expect(listener).toHaveBeenCalledWith('ירושלים');
  });

  it('survives a failing geocoder', async () => {
    await expect(requestAddress(1, 1, async () => Promise.reject(new Error('x')))).resolves.toBe(
      null,
    );
  });
});

describe('the geofence at a point', () => {
  const geofences = {
    1: { id: 1, name: 'מחסן', area: 'CIRCLE (32.1 34.8, 200)' },
    2: { id: 2, name: 'אתר', area: 'POLYGON ((31 35, 31 35.1, 31.1 35.1, 31.1 35, 31 35))' },
  };

  it('finds a circle and a polygon, and nothing elsewhere', () => {
    expect(geofenceAt(geofences, 32.1005, 34.8)?.name).toBe('מחסן');
    expect(geofenceAt(geofences, 31.05, 35.05)?.name).toBe('אתר');
    expect(geofenceAt(geofences, 30, 30)).toBeNull();
    expect(geofenceAt({ 3: { area: 'POLYGON ((broken' } }, 1, 1)).toBeNull();
  });
});
