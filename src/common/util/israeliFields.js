// Israeli identifiers (ADM-06): check, normalize and display. Pure, unit-tested.
//
//   plate       7 or 8 digits (older plates 5-6), shown and stored as 12-345-67 / 123-45-678
//   israeliId   9 digits with the check digit (shorter numbers are padded with zeros)
//   companyId   ח.פ. / ע.מ.: 9 digits, the same check digit
//   phone       Israeli mobile or landline, stored in E.164 (+972501234567) for WhatsApp and SMS
//   imei        15 digits with the Luhn check digit
//   vin         17 characters, no I, O or Q
//   year        a model year between 1950 and next year

export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');

// ─── plates ─────────────────────────────────────────────────────────────────

export const isValidPlate = (value) => /^\d{5,8}$/.test(digitsOf(value));

export const formatPlate = (value) => {
  const d = digitsOf(value);
  switch (d.length) {
    case 8:
      return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
    case 7:
      return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    case 6:
      return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
    case 5:
      return `${d.slice(0, 2)}-${d.slice(2)}`;
    default:
      return String(value ?? '').trim();
  }
};

export const samePlate = (a, b) => Boolean(digitsOf(a)) && digitsOf(a) === digitsOf(b);

// ─── ID numbers ─────────────────────────────────────────────────────────────

// The Israeli check digit (ID numbers and company numbers alike).
const checkDigitValid = (digits) => {
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    let step = Number(padded[i]) * ((i % 2) + 1);
    if (step > 9) step -= 9;
    sum += step;
  }
  return sum % 10 === 0;
};

export const isValidIsraeliId = (value) => {
  const d = digitsOf(value);
  return d.length >= 5 && d.length <= 9 && /^\d+$/.test(String(value).trim()) && checkDigitValid(d);
};

export const normalizeIsraeliId = (value) => {
  const d = digitsOf(value);
  return d ? d.padStart(9, '0') : '';
};

export const isValidCompanyId = (value) => {
  const d = digitsOf(value);
  return d.length === 9 && checkDigitValid(d);
};

// ─── phones ─────────────────────────────────────────────────────────────────

// "050-1234567", "0501234567", "+972 50 123 4567", "972501234567" -> "+972501234567".
// Returns null when it is not an Israeli number.
export const normalizePhone = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let d = digitsOf(raw);
  if (d.startsWith('972')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  else return null;
  // Mobile 5X + 7 digits; landlines 2,3,4,8,9 + 7 digits; 7X (VoIP) + 7 digits.
  if (/^(5\d|7\d)\d{7}$/.test(d) || /^[23489]\d{7}$/.test(d)) {
    return `+972${d}`;
  }
  return null;
};

export const isValidPhone = (value) => normalizePhone(value) != null;

// "+972501234567" -> "050-123-4567" for display.
export const formatPhone = (value) => {
  const e164 = normalizePhone(value);
  if (!e164) return String(value ?? '');
  const local = `0${e164.slice(4)}`;
  return local.length === 10
    ? `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`
    : `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
};

// ─── devices and vehicles ───────────────────────────────────────────────────

export const isValidImei = (value) => {
  const d = String(value ?? '').trim();
  if (!/^\d{15}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let n = Number(d[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
};

// A device identifier that looks like an IMEI (15 digits) but fails its check digit: probably a
// typo. Other identifiers (serials, phone numbers) are not judged.
export const looksLikeBadImei = (value) =>
  /^\d{15}$/.test(String(value ?? '').trim()) && !isValidImei(value);

export const isValidVin = (value) =>
  /^[A-HJ-NPR-Z0-9]{17}$/.test(
    String(value ?? '')
      .trim()
      .toUpperCase(),
  );

export const isValidModelYear = (value, now = new Date()) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1950 && year <= now.getFullYear() + 1;
};

export const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? '').trim());

// ─── field kinds for forms ──────────────────────────────────────────────────

// For each kind: the keyboard and input type on phones, the normalization on blur, and the error
// (a translation key) for a value that is not valid. Empty values are always allowed.
export const FIELD_KINDS = {
  plate: {
    inputMode: 'numeric',
    normalize: (value) => (isValidPlate(value) ? formatPlate(value) : value),
    error: (value) => (isValidPlate(value) ? null : 'validationPlate'),
  },
  israeliId: {
    inputMode: 'numeric',
    normalize: (value) => (isValidIsraeliId(value) ? normalizeIsraeliId(value) : value),
    error: (value) => (isValidIsraeliId(value) ? null : 'validationIsraeliId'),
  },
  companyId: {
    inputMode: 'numeric',
    normalize: (value) => digitsOf(value) || value,
    error: (value) => (isValidCompanyId(value) ? null : 'validationCompanyId'),
  },
  phone: {
    inputMode: 'tel',
    type: 'tel',
    normalize: (value) => normalizePhone(value) || value,
    error: (value) => (isValidPhone(value) ? null : 'validationPhone'),
  },
  email: {
    inputMode: 'email',
    type: 'email',
    normalize: (value) => String(value).trim(),
    error: (value) => (isValidEmail(value) ? null : 'validationEmail'),
  },
  vin: {
    normalize: (value) => String(value).trim().toUpperCase(),
    error: (value) => (isValidVin(value) ? null : 'validationVin'),
  },
  year: {
    inputMode: 'numeric',
    normalize: (value) => value,
    error: (value) => (isValidModelYear(value) ? null : 'validationYear'),
  },
};

export const fieldError = (kind, value) => {
  if (value === '' || value == null || !FIELD_KINDS[kind]) return null;
  return FIELD_KINDS[kind].error(value);
};
