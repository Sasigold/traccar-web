import { describe, expect, it } from 'vitest';
import { auditAction, auditObject, auditPath } from '../auditLabels';

const t = (key) => `<${key}>`;

describe('audit log labels (REP-22)', () => {
  it('translates known actions and object types and keeps unknown ones', () => {
    expect(auditAction('create', t)).toBe('<auditActionCreate>');
    expect(auditAction('REMOVE', t)).toBe('<sharedRemove>');
    expect(auditAction('reboot', t)).toBe('reboot');
    expect(auditObject('device', t)).toBe('<sharedDevice>');
    expect(auditObject('order', t)).toBe('order');
  });

  it('links to the record page when there is one', () => {
    expect(auditPath('device', 12)).toBe('/settings/device/12');
    expect(auditPath('server', 1)).toBeNull();
    expect(auditPath('geofence', 0)).toBeNull();
  });
});
