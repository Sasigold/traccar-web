// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { fieldError } from '../util/israeliFields';
// Structured vehicle and driver details kept in the Traccar `attributes`
// JSON, so they work without the fleet database. Stage 1 migrates these keys into the
// `vehicles` / `drivers` tables; keep the keys stable until then.
//
// Dates are stored as plain `YYYY-MM-DD` strings.

export const LICENSE_CLASSES = [
  'A2',
  'A1',
  'A',
  'B',
  'C1',
  'C',
  'C+E',
  'D',
  'D1',
  'D2',
  'D3',
  'E',
  '1',
];

export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric', 'gas'];

export const OWNERSHIP_TYPES = ['owned', 'leased', 'rented'];

export const DRIVER_STATUSES = ['active', 'suspended', 'ended'];

const leased = (attributes) => attributes?.ownership === 'leased';

// when: shown only for these attributes (a lease's fields, for a leased vehicle).
// type: text | date | select | multiselect | number | multiline | boolean.
// kind: an Israeli identifier checked and normalized on blur (common/util/israeliFields.js).
// ltr: values that stay left-to-right in a Hebrew UI (numbers, codes, plates).
export const vehicleFields = [
  { key: 'plateNumber', labelKey: 'fleetPlateNumber', type: 'text', ltr: true, kind: 'plate' },
  { key: 'vin', labelKey: 'fleetVin', type: 'text', ltr: true, kind: 'vin' },
  { key: 'make', labelKey: 'fleetMake', type: 'text' },
  { key: 'vehicleModel', labelKey: 'fleetVehicleModel', type: 'text' },
  { key: 'modelYear', labelKey: 'fleetModelYear', type: 'number', ltr: true, kind: 'year' },
  {
    key: 'fuelType',
    labelKey: 'fleetFuelType',
    type: 'select',
    options: FUEL_TYPES,
    optionPrefix: 'fleetFuel',
  },
  {
    key: 'ownership',
    labelKey: 'fleetOwnership',
    type: 'select',
    options: OWNERSHIP_TYPES,
    optionPrefix: 'fleetOwnership',
  },
  // ADM-31: a lease contract's kilometers: the quota for the whole contract, the odometer when it
  // started and the price of every kilometer over it (with leaseEndDate, under validity).
  { key: 'leaseStartDate', labelKey: 'fleetLeaseStartDate', type: 'date', when: leased },
  { key: 'leaseStartKm', labelKey: 'fleetLeaseStartKm', type: 'number', ltr: true, when: leased },
  { key: 'leaseKmQuota', labelKey: 'fleetLeaseKmQuota', type: 'number', ltr: true, when: leased },
  {
    key: 'leaseExcessRate',
    labelKey: 'fleetLeaseExcessRate',
    type: 'number',
    ltr: true,
    money: true,
    when: leased,
  },
  // ISR-05: the list price ("מחיר מחירון"), for the taxable benefit of a company car.
  { key: 'listPrice', labelKey: 'fleetListPrice', type: 'number', ltr: true, money: true },
  // ISR-12: a vehicle new drivers should not get (a truck, a passenger van).
  { key: 'noNewDrivers', labelKey: 'fleetNoNewDrivers', type: 'boolean' },
  // AI-08: the manufacturer's warranty, so a repair it may cover is flagged on the work order.
  { key: 'warrantyUntil', labelKey: 'fleetWarrantyUntil', type: 'date' },
  { key: 'warrantyKm', labelKey: 'fleetWarrantyKm', type: 'number', ltr: true },
];

export const vehicleExpiryFields = [
  { key: 'testExpiry', labelKey: 'fleetTestExpiry', type: 'date' },
  { key: 'insuranceCompulsoryExpiry', labelKey: 'fleetInsuranceCompulsoryExpiry', type: 'date' },
  {
    key: 'insuranceComprehensiveExpiry',
    labelKey: 'fleetInsuranceComprehensiveExpiry',
    type: 'date',
  },
  { key: 'leaseEndDate', labelKey: 'fleetLeaseEndDate', type: 'date' },
];

export const driverFields = [
  { key: 'nationalId', labelKey: 'fleetNationalId', type: 'text', ltr: true, kind: 'israeliId' },
  { key: 'phone', labelKey: 'sharedPhone', type: 'text', ltr: true, kind: 'phone' },
  { key: 'email', labelKey: 'userEmail', type: 'text', ltr: true, kind: 'email' },
  { key: 'hireDate', labelKey: 'fleetHireDate', type: 'date' },
  {
    key: 'driverStatus',
    labelKey: 'fleetDriverStatus',
    type: 'select',
    options: DRIVER_STATUSES,
    optionPrefix: 'fleetDriverStatus',
  },
];

export const driverLicenseFields = [
  { key: 'licenseNumber', labelKey: 'fleetLicenseNumber', type: 'text', ltr: true },
  {
    key: 'licenseClasses',
    labelKey: 'fleetLicenseClasses',
    type: 'multiselect',
    options: LICENSE_CLASSES,
  },
  // ISR-12: when the license was first issued; a driver is "new" for the first two years.
  { key: 'licenseIssued', labelKey: 'fleetLicenseIssued', type: 'date', newDriver: true },
];

export const driverExpiryFields = [
  { key: 'licenseExpiry', labelKey: 'fleetLicenseExpiry', type: 'date' },
];

export const notesField = { key: 'fleetNotes', labelKey: 'fleetNotes', type: 'multiline' };

export const vehicleFieldKeys = [...vehicleFields, ...vehicleExpiryFields, notesField].map(
  (field) => field.key,
);

export const driverFieldKeys = [
  ...driverFields,
  ...driverLicenseFields,
  ...driverExpiryFields,
  notesField,
].map((field) => field.key);

// "Remaining X days" window used by every expiry badge and the dashboard tile.
export const EXPIRY_WINDOW_DAYS = 30;

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

// Accepts `YYYY-MM-DD` (read as a local date, not UTC) or anything Date understands.
const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const daysUntilDate = (value, now = new Date()) => {
  const date = parseDate(value);
  if (!date) {
    return null;
  }
  return Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
};

// none | expired | expiring | valid
export const expiryStatus = (value, now = new Date(), windowDays = EXPIRY_WINDOW_DAYS) => {
  const days = daysUntilDate(value, now);
  if (days == null) {
    return 'none';
  }
  if (days < 0) {
    return 'expired';
  }
  if (days <= windowDays) {
    return 'expiring';
  }
  return 'valid';
};

const statusRank = { expired: 3, expiring: 2, valid: 1, none: 0 };

// The most urgent status among several dates.
export const worstStatus = (statuses) =>
  statuses.reduce(
    (worst, status) => (statusRank[status] > statusRank[worst] ? status : worst),
    'none',
  );

// Flat list of every dated item for a set of vehicles (Traccar devices) and drivers.
export const collectExpiries = (devices = [], drivers = [], now = new Date()) => {
  const rows = [];
  const add = (entity, item, fields) => {
    fields.forEach((field) => {
      const value = item.attributes?.[field.key];
      if (!value || !parseDate(value)) {
        return;
      }
      rows.push({
        id: `${entity}-${item.id}-${field.key}`,
        entity,
        entityId: item.id,
        name: item.name,
        plateNumber: entity === 'vehicle' ? item.attributes?.plateNumber : undefined,
        field: field.key,
        labelKey: field.labelKey,
        date: value,
        days: daysUntilDate(value, now),
        status: expiryStatus(value, now),
      });
    });
  };
  devices.forEach((device) => add('vehicle', device, vehicleExpiryFields));
  drivers
    .filter((driver) => driver.attributes?.driverStatus !== 'ended')
    .forEach((driver) => add('driver', driver, driverExpiryFields));
  return rows.sort((a, b) => a.days - b.days);
};

export const countExpiries = (rows) =>
  rows.reduce(
    (result, row) => {
      if (row.status === 'expired' || row.status === 'expiring') {
        result[row.status] += 1;
      }
      return result;
    },
    { expired: 0, expiring: 0 },
  );

export const entityExpiryStatus = (item, fields, now = new Date()) =>
  worstStatus(fields.map((field) => expiryStatus(item?.attributes?.[field.key], now)));

// Split `attributes` so the free-form editor doesn't show the structured keys twice.
export const splitAttributes = (attributes, keys) => {
  const other = {};
  Object.entries(attributes || {}).forEach(([key, value]) => {
    if (!keys.includes(key)) {
      other[key] = value;
    }
  });
  return other;
};

export const mergeAttributes = (attributes, keys, other) => {
  const result = { ...other };
  keys.forEach((key) => {
    if (attributes?.[key] !== undefined) {
      result[key] = attributes[key];
    }
  });
  return result;
};

// Diagnostic trouble codes reported by the tracker (`dtcs`, some protocols use `faults`).
export const faultCodes = (position) => {
  const raw = [position?.attributes?.dtcs, position?.attributes?.faults]
    .filter((value) => value != null && value !== '')
    .join(',');
  return [
    ...new Set(
      String(raw)
        .split(/[\s,;]+/)
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ];
};

// ADM-06: are the fleet fields valid (every field with a kind holds a valid value or nothing)?
export const fleetFieldsValid = (fields, attributes) =>
  fields.every((field) => !field.kind || !fieldError(field.kind, attributes?.[field.key]));
