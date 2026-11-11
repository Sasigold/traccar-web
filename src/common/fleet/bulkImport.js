// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// ADM-13: setting up a fleet from a spreadsheet: vehicles, drivers and points of interest.
// Pure, unit-tested. The file is read and the columns guessed as in the fuel import; each row is
// checked with the same Israeli field checks as the forms (ADM-06), and rows that already exist
// (same identifier, plate or name) are skipped rather than added twice.

import { guessColumns, parseDate, parseNumber } from './fuelImport';
import {
  digitsOf,
  fieldError,
  FIELD_KINDS,
  formatPlate,
  looksLikeBadImei,
} from '../util/israeliFields';

const date = (value) => {
  const parsed = parseDate(value);
  if (!parsed) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

// Field: hints (header words), kind (Israeli field check), type (text, number, date).
export const IMPORT_KINDS = {
  vehicles: {
    required: ['name', 'uniqueId'],
    fields: {
      name: { hints: ['שם', 'כינוי', 'name'] },
      uniqueId: { hints: ['imei', 'מזהה', 'מכשיר', 'identifier', 'device', 'unique'] },
      plateNumber: { hints: ['רישוי', 'לוחית', 'מספר רכב', 'plate', 'license'], kind: 'plate' },
      phone: { hints: ['סים', 'טלפון', 'phone', 'sim'], kind: 'phone' },
      model: { hints: ['דגם מכשיר', 'model'] },
      make: { hints: ['יצרן', 'make', 'manufacturer'] },
      vehicleModel: { hints: ['דגם', 'vehicle model'] },
      modelYear: { hints: ['שנת', 'שנה', 'year'], kind: 'year', type: 'number' },
      group: { hints: ['קבוצה', 'group'] },
      testExpiry: { hints: ['טסט', 'רישיון רכב', 'test'], type: 'date' },
      insuranceCompulsoryExpiry: { hints: ['ביטוח חובה', 'insurance'], type: 'date' },
    },
  },
  drivers: {
    required: ['name', 'uniqueId'],
    fields: {
      name: { hints: ['שם', 'name'] },
      uniqueId: {
        hints: ['מספר עובד', 'קוד', 'תג', 'מזהה', 'identifier', 'ibutton', 'rfid', 'code'],
      },
      nationalId: {
        hints: ['תעודת זהות', 'ת.ז', 'תז', 'id number', 'national'],
        kind: 'israeliId',
      },
      phone: { hints: ['טלפון', 'נייד', 'phone', 'mobile'], kind: 'phone' },
      email: { hints: ['אימייל', 'דוא"ל', 'מייל', 'email'], kind: 'email' },
      licenseNumber: { hints: ['מספר רישיון', 'license number'] },
      licenseExpiry: { hints: ['תוקף רישיון', 'license expiry', 'expiry'], type: 'date' },
    },
  },
  pois: {
    required: ['name', 'latitude', 'longitude'],
    fields: {
      name: { hints: ['שם', 'name'] },
      latitude: { hints: ['רוחב', 'lat', 'latitude'], type: 'number' },
      longitude: { hints: ['אורך', 'lon', 'lng', 'longitude'], type: 'number' },
      radius_m: { hints: ['רדיוס', 'radius'], type: 'number' },
      address: { hints: ['כתובת', 'address'] },
      contact_name: { hints: ['איש קשר', 'contact'] },
      phone: { hints: ['טלפון', 'phone'], kind: 'phone' },
    },
  },
};

export const importFields = (kind) => Object.keys(IMPORT_KINDS[kind].fields);

export const guessImportColumns = (kind, headers) =>
  guessColumns(
    headers,
    Object.fromEntries(
      Object.entries(IMPORT_KINDS[kind].fields).map(([key, field]) => [key, field.hints]),
    ),
  );

const clean = (value, field) => {
  if (value == null || String(value).trim() === '') return null;
  if (field.type === 'number') return parseNumber(value);
  if (field.type === 'date') return date(value);
  const text = String(value).trim();
  return field.kind ? FIELD_KINDS[field.kind].normalize(text) : text;
};

// rows (without the header) -> [{ line, values, errors: [{ field, key }], duplicate }].
// existing: { identifiers: Set, plates: Set (digits), names: Set (lower case) }.
export const buildImportRows = (kind, rows, mapping, existing = {}) => {
  const spec = IMPORT_KINDS[kind];
  const seen = new Set();
  return rows.map((row, index) => {
    const values = {};
    const errors = [];
    Object.entries(spec.fields).forEach(([key, field]) => {
      if (mapping[key] === undefined) return;
      const raw = row[mapping[key]];
      const value = clean(raw, field);
      if (value == null && raw != null && String(raw).trim() !== '') {
        errors.push({
          field: key,
          key: field.type === 'date' ? 'importBadDate' : 'importBadNumber',
        });
        return;
      }
      const error = field.kind ? fieldError(field.kind, value) : null;
      if (error) errors.push({ field: key, key: error });
      if (value != null) values[key] = value;
    });
    spec.required.forEach((key) => {
      if (values[key] == null && !errors.some((error) => error.field === key)) {
        errors.push({ field: key, key: 'importRequired' });
      }
    });
    if (kind === 'vehicles' && looksLikeBadImei(values.uniqueId)) {
      errors.push({ field: 'uniqueId', key: 'validationImei' });
    }
    if (kind === 'pois') {
      if (values.latitude != null && Math.abs(values.latitude) > 90) {
        errors.push({ field: 'latitude', key: 'importBadNumber' });
      }
      if (values.longitude != null && Math.abs(values.longitude) > 180) {
        errors.push({ field: 'longitude', key: 'importBadNumber' });
      }
    }
    // The same thing twice: in the system already, or earlier in this file.
    const identity =
      kind === 'pois'
        ? String(values.name || '').toLowerCase()
        : String(values.uniqueId || '').toLowerCase();
    const plate = values.plateNumber ? digitsOf(values.plateNumber) : null;
    let duplicate = null;
    if (identity && (kind === 'pois' ? existing.names : existing.identifiers)?.has(identity)) {
      duplicate = 'importExists';
    } else if (plate && existing.plates?.has(plate)) {
      duplicate = 'importPlateExists';
    } else if (identity && seen.has(identity)) {
      duplicate = 'importTwiceInFile';
    }
    if (identity) seen.add(identity);
    return { line: index + 2, values, errors, duplicate };
  });
};

// A checked row -> what Traccar (devices, drivers) or the fleet database (pois) takes.
// groups: { name (lower case) -> id }.
export const importEntity = (kind, values, { groups = {} } = {}) => {
  if (kind === 'vehicles') {
    const { name, uniqueId, phone, model, group, ...attributes } = values;
    if (attributes.plateNumber) attributes.plateNumber = formatPlate(attributes.plateNumber);
    return {
      name,
      uniqueId: String(uniqueId),
      phone: phone || null,
      model: model || null,
      groupId: (group && groups[String(group).toLowerCase()]) || 0,
      attributes,
    };
  }
  if (kind === 'drivers') {
    const { name, uniqueId, ...attributes } = values;
    return { name, uniqueId: String(uniqueId), attributes };
  }
  return { radius_m: 100, ...values };
};
