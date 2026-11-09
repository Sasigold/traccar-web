import { describe, expect, it } from 'vitest';
import {
  fieldError,
  formatPhone,
  formatPlate,
  isValidCompanyId,
  isValidImei,
  isValidIsraeliId,
  isValidModelYear,
  isValidVin,
  looksLikeBadImei,
  normalizeIsraeliId,
  normalizePhone,
  samePlate,
} from '../israeliFields';

describe('Israeli fields (ADM-06)', () => {
  it('formats plates of every length and compares them by digits', () => {
    expect(formatPlate('1234567')).toBe('12-345-67');
    expect(formatPlate('12345678')).toBe('123-45-678');
    expect(formatPlate('12 345 67')).toBe('12-345-67');
    expect(formatPlate('123456')).toBe('12-34-56');
    expect(samePlate('12-345-67', '1234567')).toBe(true);
    expect(samePlate('', '')).toBe(false);
  });

  it('checks ID numbers with the check digit and pads short ones', () => {
    expect(isValidIsraeliId('123456782')).toBe(true);
    expect(isValidIsraeliId('123456789')).toBe(false);
    expect(isValidIsraeliId('12345678a')).toBe(false);
    expect(isValidIsraeliId('1234')).toBe(false);
    expect(normalizeIsraeliId('23456783')).toBe('023456783');
    expect(isValidIsraeliId('23456783')).toBe(true);
  });

  it('checks company numbers', () => {
    expect(isValidCompanyId('515555556')).toBe(false);
    expect(isValidCompanyId('513344473')).toBe(true);
  });

  it('normalizes Israeli phones to E.164 and shows them locally', () => {
    expect(normalizePhone('050-1234567')).toBe('+972501234567');
    expect(normalizePhone('+972 50 123 4567')).toBe('+972501234567');
    expect(normalizePhone('972-3-1234567')).toBe('+97231234567');
    expect(normalizePhone('03-1234567')).toBe('+97231234567');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+1 212 555 0100')).toBeNull();
    expect(formatPhone('+972501234567')).toBe('050-123-4567');
    expect(formatPhone('+97231234567')).toBe('03-123-4567');
  });

  it('checks IMEI, VIN and model year', () => {
    expect(isValidImei('490154203237518')).toBe(true);
    expect(isValidImei('490154203237519')).toBe(false);
    expect(looksLikeBadImei('490154203237519')).toBe(true);
    expect(looksLikeBadImei('demo-1')).toBe(false);
    expect(isValidVin('4V4NC9EH5GN123456')).toBe(true);
    expect(isValidVin('4V4NC9EH5GN12345O')).toBe(false);
    expect(isValidVin('SHORT')).toBe(false);
    const now = new Date('2026-11-09');
    expect(isValidModelYear(2027, now)).toBe(true);
    expect(isValidModelYear(2028, now)).toBe(false);
    expect(isValidModelYear(1949, now)).toBe(false);
  });

  it('reports a translation key for invalid values, and accepts empty ones', () => {
    expect(fieldError('plate', '123')).toBe('validationPlate');
    expect(fieldError('plate', '')).toBeNull();
    expect(fieldError('israeliId', '123456789')).toBe('validationIsraeliId');
    expect(fieldError('phone', '050-1234567')).toBeNull();
    expect(fieldError('email', 'not-an-email')).toBe('validationEmail');
    expect(fieldError('unknown', 'x')).toBeNull();
  });
});
