import { describe, expect, it } from 'vitest';
import { camelCase, capitalize, pascalCase, prefixString } from '../stringUtils';

describe('name conversions (ARC-10)', () => {
  it('capitalizes the first letter only', () => {
    expect(capitalize('fuel')).toBe('Fuel');
    expect(capitalize('on_road')).toBe('On_road');
    expect(capitalize('')).toBe('');
    expect(capitalize(null)).toBe('');
  });

  it('turns database values into translation key parts', () => {
    expect(pascalCase('in_shop')).toBe('InShop');
    expect(pascalCase('safety_officer')).toBe('SafetyOfficer');
    expect(pascalCase('owner')).toBe('Owner');
    expect(camelCase('driver_answer')).toBe('driverAnswer');
    expect(camelCase(undefined)).toBe('');
  });

  it('keeps prefixString as it was', () => {
    expect(prefixString('event', 'deviceOnline')).toBe('eventDeviceOnline');
  });
});
