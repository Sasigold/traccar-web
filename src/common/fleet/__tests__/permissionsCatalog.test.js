import { describe, expect, it } from 'vitest';
import {
  PERMISSION_AREAS,
  effectiveGranted,
  permissionLabelKey,
  toggleChange,
  traccarFlagsForRole,
} from '../permissionsCatalog';

describe('permission catalog', () => {
  it('lists every key once', () => {
    const keys = PERMISSION_AREAS.flatMap((area) => area.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect(permissionLabelKey('inspections.manage')).toBe('fleetPermInspectionsManage');
  });

  it('resolves owner, overrides and defaults', () => {
    const defaults = [{ role: 'manager', permission: 'costs.read' }];
    const overrides = [
      { role: 'manager', permission: 'costs.read', granted: false },
      { role: 'viewer', permission: 'costs.read', granted: true },
    ];
    expect(effectiveGranted('owner', 'anything', defaults, overrides)).toBe(true);
    expect(effectiveGranted('manager', 'costs.read', defaults, overrides)).toBe(false);
    expect(effectiveGranted('viewer', 'costs.read', defaults, overrides)).toBe(true);
    expect(effectiveGranted('driver', 'costs.read', defaults, overrides)).toBe(false);
  });

  it('only stores differences from the default', () => {
    const defaults = [{ role: 'manager', permission: 'costs.read' }];
    expect(toggleChange('manager', 'costs.read', true, defaults)).toEqual({ remove: true });
    expect(toggleChange('manager', 'costs.read', false, defaults)).toEqual({
      upsert: { role: 'manager', permission: 'costs.read', granted: false },
    });
    expect(toggleChange('viewer', 'costs.read', false, defaults)).toEqual({ remove: true });
  });

  it('maps roles to Traccar flags', () => {
    expect(traccarFlagsForRole('manager')).toEqual({
      readonly: false,
      deviceReadonly: false,
      limitCommands: false,
    });
    expect(traccarFlagsForRole('driver')).toEqual({
      readonly: true,
      deviceReadonly: true,
      limitCommands: true,
    });
    expect(traccarFlagsForRole('dispatcher').deviceReadonly).toBe(true);
  });
});

describe('role labels', () => {
  it('camel-cases role names with underscores', async () => {
    const { roleLabelKey } = await import('../permissionsCatalog');
    expect(roleLabelKey('safety_officer')).toBe('fleetRoleSafetyOfficer');
    expect(roleLabelKey('admin')).toBe('fleetRoleAdmin');
  });
});
