import { describe, expect, it } from 'vitest';
import { areaKey } from '../components/FleetNotice';

describe('no-access texts (ADM-21)', () => {
  it('name the area, never the permission key', () => {
    expect(areaKey('maintenance.read')).toBe('fleetAreaMaintenance');
    expect(areaKey('poi.write')).toBe('fleetAreaPoi');
    expect(areaKey('customers.manage')).toBeNull();
    expect(areaKey(undefined)).toBeNull();
  });
});
