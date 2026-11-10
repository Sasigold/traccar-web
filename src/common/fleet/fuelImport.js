// Roadmap stage 2: fuel company file import (pure, unit-tested).
// Fuel companies send CSV / Excel files with their own headers; the importer guesses which
// column is which, lets the person correct it, matches vehicles by plate and flags anomalies.

export const FUEL_FIELDS = [
  'occurred_at',
  'plate_number',
  'liters',
  'total',
  'unit_price',
  'station',
  'odometer_reported',
  'external_id',
  'fuel_type',
  'driver_name',
];

export const REQUIRED_FUEL_FIELDS = ['occurred_at', 'total'];

// Header words per field, Hebrew and English, matched after normalizing.
const HINTS = {
  occurred_at: ['תאריך', 'מועד', 'date', 'time', 'datetime'],
  plate_number: ['רישוי', 'מספר רכב', 'רכב', 'לוחית', 'plate', 'vehicle', 'license'],
  liters: ['ליטר', 'כמות', 'liters', 'litres', 'quantity', 'volume', 'qty'],
  total: ['סכום', 'סה"כ', 'סהכ', 'לתשלום', 'total', 'amount', 'sum'],
  unit_price: ['מחיר לליטר', 'מחיר ליחידה', 'מחיר', 'price'],
  station: ['תחנה', 'אתר', 'station', 'site', 'location'],
  odometer_reported: ['קילומטראז', 'ק"מ', 'קמ', 'מד אוץ', 'odometer', 'km', 'mileage'],
  external_id: ['אסמכתא', 'מספר עסקה', 'עסקה', 'transaction', 'reference', 'receipt', 'id'],
  fuel_type: ['סוג דלק', 'מוצר', 'דלק', 'product', 'fuel'],
  driver_name: ['נהג', 'driver'],
};

const normalize = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[״"׳']/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// { field: columnIndex } for the columns whose header matches a hint; each column used once.
export const guessColumns = (headers, hints = HINTS) => {
  const mapping = {};
  const used = new Set();
  const names = headers.map(normalize);
  // Longer hints first, so "מחיר לליטר" wins over "מחיר" and "סוג דלק" over "דלק".
  const pairs = Object.entries(hints)
    .flatMap(([field, hints]) => hints.map((hint) => [field, normalize(hint)]))
    .sort((a, b) => b[1].length - a[1].length);
  pairs.forEach(([field, hint]) => {
    if (mapping[field] !== undefined) {
      return;
    }
    const index = names.findIndex((name, i) => !used.has(i) && name.includes(hint));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  });
  return mapping;
};

// Minimal CSV: quotes, escaped quotes, commas / semicolons / tabs, CRLF.
export const parseCsv = (text) => {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t'].sort(
    (a, b) => firstLine.split(b).length - firstLine.split(a).length,
  )[0];
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => String(value).trim()));
};

export const parseNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value ?? '')
    .replace(/[₪\s]/g, '')
    .replace(/,(?=\d{3}(\D|$))/g, '');
  if (!text) {
    return null;
  }
  const number = Number(text.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
};

// Israeli files write day first: 06/11/2026 14:30, 6.11.26; ISO and Date objects pass through.
export const parseDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const text = String(value ?? '').trim();
  const local =
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (local) {
    const year = local[3].length === 2 ? 2000 + Number(local[3]) : Number(local[3]);
    const date = new Date(
      year,
      Number(local[2]) - 1,
      Number(local[1]),
      Number(local[4] || 0),
      Number(local[5] || 0),
      Number(local[6] || 0),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

export const normalizePlate = (value) => String(value ?? '').replace(/\D/g, '');

const FREQUENT_HOURS = 3;
const CAPACITY_MARGIN = 1.05;

// Rows -> transactions with a vehicle match and anomaly flags.
// vehicles: [{ id, traccarId, plate, fuelCapacity, fuelType }].
export const buildTransactions = (rows, mapping, vehicles) => {
  const byPlate = new Map(vehicles.map((vehicle) => [normalizePlate(vehicle.plate), vehicle]));
  const cell = (row, field) => (mapping[field] === undefined ? undefined : row[mapping[field]]);
  const result = rows.map((row, index) => {
    const date = parseDate(cell(row, 'occurred_at'));
    const total = parseNumber(cell(row, 'total'));
    const liters = parseNumber(cell(row, 'liters'));
    const plate = String(cell(row, 'plate_number') ?? '').trim();
    const vehicle = byPlate.get(normalizePlate(plate)) || null;
    const errors = [];
    if (!date) {
      errors.push('date');
    }
    if (total == null) {
      errors.push('total');
    }
    const flags = [];
    if (!vehicle) {
      flags.push('unknown_vehicle');
    }
    if (
      vehicle?.fuelCapacity &&
      liters != null &&
      liters > vehicle.fuelCapacity * CAPACITY_MARGIN
    ) {
      flags.push('over_capacity');
    }
    const fuelType = String(cell(row, 'fuel_type') ?? '').trim() || null;
    if (vehicle?.fuelType && fuelType && fuelMismatch(vehicle.fuelType, fuelType)) {
      flags.push('wrong_fuel');
    }
    return {
      line: index + 1,
      errors,
      flags,
      vehicle,
      occurred_at: date ? date.toISOString() : null,
      plate_number: plate || null,
      liters,
      total,
      unit_price:
        parseNumber(cell(row, 'unit_price')) ??
        (liters && total != null ? Math.round((total / liters) * 100) / 100 : null),
      station: String(cell(row, 'station') ?? '').trim() || null,
      odometer_reported: parseNumber(cell(row, 'odometer_reported')),
      external_id: String(cell(row, 'external_id') ?? '').trim() || null,
      fuel_type: fuelType,
      driver_name: String(cell(row, 'driver_name') ?? '').trim() || null,
    };
  });
  // Two fills of the same vehicle within a few hours.
  const byVehicle = new Map();
  result
    .filter((tx) => tx.vehicle && tx.occurred_at)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1))
    .forEach((tx) => {
      const previous = byVehicle.get(tx.vehicle.id);
      if (
        previous &&
        Date.parse(tx.occurred_at) - Date.parse(previous.occurred_at) < FREQUENT_HOURS * 3600000
      ) {
        if (!tx.flags.includes('too_frequent')) {
          tx.flags.push('too_frequent');
        }
      }
      byVehicle.set(tx.vehicle.id, tx);
    });
  return result;
};

const FUEL_WORDS = {
  petrol: ['בנזין', '95', '98', 'petrol', 'gasoline', 'unleaded'],
  diesel: ['סולר', 'דיזל', 'diesel'],
  gas: ['גז', 'gas', 'lpg'],
};

// True when the product clearly belongs to another fuel than the vehicle's.
export const fuelMismatch = (vehicleFuel, product) => {
  const text = normalize(product);
  const matched = Object.entries(FUEL_WORDS).find(([, words]) =>
    words.some((word) => text.includes(word)),
  );
  if (!matched || vehicleFuel === 'hybrid') {
    return false;
  }
  if (vehicleFuel === 'electric') {
    return true;
  }
  return matched[0] !== vehicleFuel;
};
