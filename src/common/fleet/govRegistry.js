// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// The Ministry of Transport's open vehicle registry on data.gov.il: make, model, year, VIN, fuel,
// ownership and the vehicle licence ("test") expiry, by plate number. Free, no key, CORS open.
//
// The dataset is split over several resources whose ids change; they are looked up through
// package_show (with the known ids as a fallback) and searched in turn.

const API = 'https://data.gov.il/api/3/action';
const PACKAGE = 'private-and-commercial-vehicles';
const FALLBACK_RESOURCES = [
  '053cea08-09bc-40ec-8f7a-156f0677aff3',
  '0866573c-40cd-4ca8-91d2-9dd2d7a492e5',
];

export const plateDigits = (plate) => String(plate ?? '').replace(/\D/g, '');

// Israeli plates have 7 or 8 digits (older ones 5 or 6).
export const validPlate = (plate) => /^\d{5,8}$/.test(plateDigits(plate));

const fuelOf = (name = '') => {
  if (/חשמל/.test(name)) {
    return /בנזין|דיזל|סולר/.test(name) ? 'hybrid' : 'electric';
  }
  if (/דיזל|סולר/.test(name)) {
    return 'diesel';
  }
  if (/בנזין/.test(name)) {
    return 'petrol';
  }
  if (/גז|גפ"מ|גפ״מ/.test(name)) {
    return 'gas';
  }
  return undefined;
};

const ownershipOf = (name = '') => {
  if (/ליסינג/.test(name)) {
    return 'leased';
  }
  if (/השכרה/.test(name)) {
    return 'rented';
  }
  return name ? 'owned' : undefined;
};

const isoDate = (value) =>
  /^\d{4}-\d{2}-\d{2}/.test(value || '') ? value.slice(0, 10) : undefined;

// A registry record as vehicle card fields (common/fleet/fleetFields.js keys).
export const registryToFields = (record) => {
  if (!record) {
    return {};
  }
  const fields = {
    make: record.tozeret_nm?.trim() || undefined,
    vehicleModel: (record.kinuy_mishari || record.degem_nm || '').trim() || undefined,
    modelYear: Number.isInteger(record.shnat_yitzur) ? record.shnat_yitzur : undefined,
    vin: record.misgeret?.trim() || undefined,
    fuelType: fuelOf(record.sug_delek_nm),
    ownership: ownershipOf(record.baalut),
    testExpiry: isoDate(record.tokef_dt),
  };
  Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
  return fields;
};

// The fields that would change on the card: [{ key, from, to }].
export const registryChanges = (attributes, fields) =>
  Object.entries(fields)
    .filter(([key, value]) => String(attributes?.[key] ?? '') !== String(value))
    .map(([key, value]) => ({ key, from: attributes?.[key] ?? null, to: value }));

let resourcesPromise = null;
const resources = () => {
  if (!resourcesPromise) {
    resourcesPromise = fetch(`${API}/package_show?id=${PACKAGE}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const ids = (json?.result?.resources || [])
          .filter((resource) => resource.datastore_active)
          .map((resource) => resource.id);
        return ids.length ? ids : FALLBACK_RESOURCES;
      })
      .catch(() => FALLBACK_RESOURCES);
  }
  return resourcesPromise;
};

// The registry record for a plate, or null when the plate is not in the registry.
export const lookupVehicle = async (plate, { signal } = {}) => {
  const digits = plateDigits(plate);
  if (!validPlate(digits)) {
    return null;
  }
  const filters = JSON.stringify({ mispar_rechev: Number(digits) });
  for (const id of await resources()) {
    const response = await fetch(
      `${API}/datastore_search?resource_id=${id}&limit=1&filters=${encodeURIComponent(filters)}`,
      { signal },
    );
    if (response.ok) {
      const record = (await response.json())?.result?.records?.[0];
      if (record) {
        return record;
      }
    }
  }
  return null;
};
