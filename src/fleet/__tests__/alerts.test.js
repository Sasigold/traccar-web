import { describe, expect, it } from 'vitest';
import { validRecipientAddress } from '../alerts';

describe('recipient addresses', () => {
  it('accepts international WhatsApp numbers only', () => {
    expect(validRecipientAddress('whatsapp', '+972501234567')).toBe(true);
    expect(validRecipientAddress('whatsapp', '+972 50-123-4567')).toBe(true);
    expect(validRecipientAddress('whatsapp', '0501234567')).toBe(false);
    expect(validRecipientAddress('whatsapp', '+0501234567')).toBe(false);
  });

  it('treats SMS numbers like WhatsApp numbers', () => {
    expect(validRecipientAddress('sms', '+972 52-111-2222')).toBe(true);
    expect(validRecipientAddress('sms', '052-111-2222')).toBe(false);
  });

  it('accepts plausible email addresses', () => {
    expect(validRecipientAddress('email', 'fleet@example.co.il')).toBe(true);
    expect(validRecipientAddress('email', 'fleet@')).toBe(false);
  });
});
