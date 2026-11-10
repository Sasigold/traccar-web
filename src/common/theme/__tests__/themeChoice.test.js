import { describe, expect, it } from 'vitest';
import { choiceOf } from '../useThemeMode';

// BRD-07: light, dark, or as the system says; the account's choice wins over the device's.
describe('the color theme choice', () => {
  it('follows the account, then the device, then light', () => {
    expect(choiceOf(true, 'light')).toBe('dark');
    expect(choiceOf(false, 'dark')).toBe('light');
    expect(choiceOf('system', 'light')).toBe('system');
    expect(choiceOf(null, 'system')).toBe('system');
    expect(choiceOf(null, 'dark')).toBe('dark');
    expect(choiceOf(null, null)).toBe('light');
    expect(choiceOf(null, 'purple')).toBe('light');
  });
});
