import { describe, expect, it } from 'vitest';
import { validRecipientAddress } from '../alerts';

describe('recipient addresses', () => {
  it('accepts WhatsApp numbers, local ones too (ADM-27)', () => {
    expect(validRecipientAddress('whatsapp', '+972501234567')).toBe(true);
    expect(validRecipientAddress('whatsapp', '+972 50-123-4567')).toBe(true);
    expect(validRecipientAddress('whatsapp', '0501234567')).toBe(true);
    expect(validRecipientAddress('whatsapp', '+0501234567')).toBe(false);
  });

  it('treats SMS numbers like WhatsApp numbers', () => {
    expect(validRecipientAddress('sms', '+972 52-111-2222')).toBe(true);
    expect(validRecipientAddress('sms', '052-111-2222')).toBe(true);
    expect(validRecipientAddress('sms', '052')).toBe(false);
  });

  it('accepts plausible email addresses', () => {
    expect(validRecipientAddress('email', 'fleet@example.co.il')).toBe(true);
    expect(validRecipientAddress('email', 'fleet@')).toBe(false);
  });
});

describe('recipient numbers as people type them (ADM-27)', () => {
  it('turn local Israeli numbers into the international form', async () => {
    const { normalizeRecipientAddress, validRecipientAddress } = await import('../alerts');
    expect(normalizeRecipientAddress('whatsapp', '050-1234567')).toBe('+972501234567');
    expect(normalizeRecipientAddress('whatsapp', '972 50 123 4567')).toBe('+972501234567');
    expect(normalizeRecipientAddress('whatsapp', '+972501234567')).toBe('+972501234567');
    expect(normalizeRecipientAddress('email', ' a@b.co ')).toBe('a@b.co');
    expect(validRecipientAddress('whatsapp', '050-1234567')).toBe(true);
    expect(validRecipientAddress('whatsapp', '050')).toBe(false);
  });
});
