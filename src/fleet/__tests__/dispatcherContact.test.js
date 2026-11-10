import { describe, expect, it } from 'vitest';
import { whatsappNumber } from '../components/DispatcherContact';

describe('dispatcher contact (ADM-22)', () => {
  it('turns a local number into a wa.me number', () => {
    expect(whatsappNumber('0501234567')).toBe('972501234567');
    expect(whatsappNumber('+972501234567')).toBe('972501234567');
    expect(whatsappNumber('050-123-4567')).toBe('972501234567');
  });
});
