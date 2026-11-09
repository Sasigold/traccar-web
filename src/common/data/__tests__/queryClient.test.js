import { describe, expect, it } from 'vitest';
import { shouldRetry } from '../queryClient';
import { fleetKey } from '../fleetQuery';

describe('data layer (ARC-06)', () => {
  it('retries network and server errors twice, never a 4xx or a database rule', () => {
    expect(shouldRetry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetry(1, { status: 503 })).toBe(true);
    expect(shouldRetry(2, { status: 503 })).toBe(false);
    expect(shouldRetry(0, { status: 403 })).toBe(false);
    expect(shouldRetry(0, { code: '42501' })).toBe(false);
    expect(shouldRetry(0, { code: 'PGRST116' })).toBe(false);
  });

  it('keys start with the organization', () => {
    expect(fleetKey('o1', 'vehicles', 'plate_number')).toEqual([
      'fleet',
      'o1',
      'vehicles',
      'plate_number',
    ]);
    expect(fleetKey(undefined, 'vendors')).toEqual(['fleet', null, 'vendors']);
  });
});

describe('writes refresh the cache (ARC-06)', async () => {
  const { writtenTables } = await import('../../fleet/client');
  it('a write to a table refreshes that table; a writing function refreshes everything', () => {
    const base = 'https://fleet.example/rest/v1';
    expect(writtenTables('POST', `${base}/vendors?select=*`)).toEqual(['vendors']);
    expect(writtenTables('PATCH', `${base}/vehicles?id=eq.1`)).toEqual(['vehicles']);
    expect(writtenTables('GET', `${base}/vehicles`)).toBeNull();
    expect(writtenTables('POST', `${base}/rpc/fleet_save`)).toEqual(['*']);
    expect(writtenTables('POST', `${base}/rpc/fleet_features`)).toBeNull();
    expect(writtenTables('POST', 'https://fleet.example/storage/v1/object/x')).toBeNull();
  });
});
