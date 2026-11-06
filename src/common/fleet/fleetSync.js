// Roadmap stage 1: map the stage 0 Traccar attributes to the fleet database and back.
// Pure functions only; the Supabase calls live in src/fleet/fleetRecords.js.

// Validity dates become documents (without a file) of these types.
export const vehicleDocumentTypes = {
  testExpiry: 'vehicle_test',
  insuranceCompulsoryExpiry: 'insurance_mandatory',
  insuranceComprehensiveExpiry: 'insurance_comprehensive',
  leaseEndDate: 'lease_agreement',
};

export const driverDocumentTypes = {
  licenseExpiry: 'driver_license',
};

export const documentTypesFor = (entity) =>
  entity === 'vehicle' ? vehicleDocumentTypes : driverDocumentTypes;

const text = (value) =>
  value === undefined || value === null || value === '' ? null : String(value);

const date = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null);

const year = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1950 && number <= 2100 ? number : null;
};

// Traccar driver status (stage 0) <-> database enum (active, inactive, suspended).
const driverStatusToDb = { active: 'active', suspended: 'suspended', ended: 'inactive' };
const driverStatusFromDb = { active: 'active', suspended: 'suspended', inactive: 'ended' };

export const vehicleRow = (device) => {
  const a = device.attributes || {};
  return {
    traccar_device_id: device.id,
    plate_number: text(a.plateNumber) || device.name,
    vin: text(a.vin),
    make: text(a.make),
    model: text(a.vehicleModel),
    year: year(a.modelYear),
    fuel_type: text(a.fuelType),
    ownership: text(a.ownership),
    leasing_end_date: date(a.leaseEndDate),
    notes: text(a.fleetNotes),
  };
};

export const driverRow = (driver) => {
  const a = driver.attributes || {};
  const classes = Array.isArray(a.licenseClasses) ? a.licenseClasses : [];
  return {
    traccar_driver_id: driver.id,
    full_name: driver.name || driver.uniqueId,
    national_id: text(a.nationalId),
    phone: text(a.phone),
    email: text(a.email),
    hire_date: date(a.hireDate),
    status: driverStatusToDb[a.driverStatus] || null,
    license_number: text(a.licenseNumber),
    license_classes: classes,
    license_class: classes[0] || null,
    license_expiry: date(a.licenseExpiry),
    notes: text(a.fleetNotes),
  };
};

// Latest expiry per document type: { vehicle_test: '2027-01-01', ... }.
export const latestExpiries = (documents) => {
  const result = {};
  documents.forEach((document) => {
    if (
      document.expires_at &&
      (!result[document.document_type] || document.expires_at > result[document.document_type])
    ) {
      result[document.document_type] = document.expires_at;
    }
  });
  return result;
};

const put = (target, key, value) => {
  if (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    !(Array.isArray(value) && !value.length)
  ) {
    target[key] = value;
  }
};

// Database values laid over the Traccar attributes: the database wins where it has a value.
export const vehicleAttributes = (attributes, row, documents = []) => {
  const result = { ...attributes };
  if (row) {
    put(result, 'plateNumber', row.plate_number);
    put(result, 'vin', row.vin);
    put(result, 'make', row.make);
    put(result, 'vehicleModel', row.model);
    put(result, 'modelYear', row.year);
    put(result, 'fuelType', row.fuel_type);
    put(result, 'ownership', row.ownership);
    put(result, 'leaseEndDate', row.leasing_end_date);
    put(result, 'fleetNotes', row.notes);
  }
  const expiries = latestExpiries(documents);
  Object.entries(vehicleDocumentTypes).forEach(([key, type]) => put(result, key, expiries[type]));
  return result;
};

export const driverAttributes = (attributes, row, documents = []) => {
  const result = { ...attributes };
  if (row) {
    put(result, 'nationalId', row.national_id);
    put(result, 'phone', row.phone);
    put(result, 'email', row.email);
    put(result, 'hireDate', row.hire_date);
    put(result, 'driverStatus', driverStatusFromDb[row.status]);
    put(result, 'licenseNumber', row.license_number);
    put(
      result,
      'licenseClasses',
      row.license_classes?.length
        ? row.license_classes
        : row.license_class
          ? [row.license_class]
          : null,
    );
    put(result, 'licenseExpiry', row.license_expiry);
    put(result, 'fleetNotes', row.notes);
  }
  const expiries = latestExpiries(documents);
  Object.entries(driverDocumentTypes).forEach(([key, type]) => put(result, key, expiries[type]));
  return result;
};

// What to do with the validity documents so they match the dates on the card.
// - no document of that type: insert one without a file;
// - the latest one already has that date: nothing;
// - the latest one has no file: move its date;
// - the latest one has a file (a real scanned document): add a new one, keep the file.
// A cleared date never deletes anything.
export const planDocumentSync = (entity, attributes, documents) => {
  const plan = { insert: [], update: [] };
  Object.entries(documentTypesFor(entity)).forEach(([key, type]) => {
    const value = date(attributes?.[key]);
    if (!value) {
      return;
    }
    const latest = documents
      .filter((document) => document.document_type === type && document.expires_at)
      .sort((a, b) => (a.expires_at < b.expires_at ? 1 : -1))[0];
    if (!latest) {
      plan.insert.push({ document_type: type, expires_at: value });
    } else if (latest.expires_at === value) {
      // up to date
    } else if (!latest.file_path) {
      plan.update.push({ id: latest.id, expires_at: value });
    } else {
      plan.insert.push({ document_type: type, expires_at: value });
    }
  });
  return plan;
};

export const hasFleetDetails = (attributes, keys) =>
  keys.some((key) => attributes?.[key] !== undefined && attributes?.[key] !== '');

const fieldForType = Object.fromEntries(
  [...Object.entries(vehicleDocumentTypes), ...Object.entries(driverDocumentTypes)].map(
    ([key, type]) => [type, key],
  ),
);

// Adds rows from the `documents_expiring` view to the attribute-based validity rows
// (collectExpiries). Per vehicle / driver and document type only the latest date is kept, so a
// renewed document doesn't leave its expired predecessor behind as an alert.
// `rows` items carry { entity, entityId, field, date }; `statusOf` is expiryStatus.
export const mergeDocumentExpiries = (rows, documents, { labelKeys, statusOf, daysOf }) => {
  const seen = new Set(
    rows.map(
      (row) =>
        `${row.entity}-${row.entityId}-${documentTypesFor(row.entity)[row.field]}-${row.date}`,
    ),
  );
  const extra = [];
  documents.forEach((document) => {
    const entityId =
      document.entity === 'vehicle' ? document.traccar_device_id : document.traccar_driver_id;
    if (document.entity === 'organization' || entityId == null || !document.expires_at) {
      return;
    }
    const key = `${document.entity}-${entityId}-${document.document_type}-${document.expires_at}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const field = fieldForType[document.document_type];
    extra.push({
      id: `document-${document.id}`,
      entity: document.entity,
      entityId,
      name: document.entity === 'vehicle' ? document.plate_number : document.driver_name,
      plateNumber: document.entity === 'vehicle' ? document.plate_number : undefined,
      field: field || document.document_type,
      labelKey: field ? labelKeys[field] : undefined,
      labels: { label_he: document.label_he, label_en: document.label_en },
      date: document.expires_at,
      days: daysOf(document.expires_at),
      status: statusOf(document.expires_at),
      hasFile: Boolean(document.file_path),
    });
  });
  const latest = new Map();
  [...rows, ...extra].forEach((row) => {
    const type = fieldForType[row.field]
      ? row.field
      : documentTypesFor(row.entity)[row.field] || row.field;
    const group = `${row.entity}-${row.entityId}-${type}`;
    const current = latest.get(group);
    if (!current || row.date > current.date) {
      latest.set(group, row);
    }
  });
  return [...latest.values()].sort((a, b) => a.days - b.days);
};
