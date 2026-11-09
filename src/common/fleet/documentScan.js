import { LICENSE_CLASSES } from './fleetFields';
import {
  fieldError,
  formatPlate,
  isValidIsraeliId,
  normalizeIsraeliId,
  samePlate,
} from '../util/israeliFields';

// AI-04: what the model read from a photo becomes form values. Pure, unit-tested. Nothing is
// saved here: the values fill the form, the user checks them (the unsure ones are marked) and
// saves as usual. A value that fails the form's own check is marked unsure too.

const isDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const clean = (entries) =>
  Object.fromEntries(entries.filter(([, value]) => value != null && value !== ''));

// Vehicle license or insurance policy -> device attributes.
export const vehicleValues = (kind, fields, current = {}) => {
  const values =
    kind === 'vehicle_license'
      ? clean([
          ['plateNumber', fields.plate_number ? formatPlate(fields.plate_number) : null],
          ['testExpiry', isDate(fields.test_expiry) ? fields.test_expiry : null],
          ['make', fields.make],
          ['vehicleModel', fields.model],
          ['modelYear', Number.isInteger(fields.model_year) ? fields.model_year : null],
          ['vin', fields.vin ? String(fields.vin).toUpperCase().replace(/\s/g, '') : null],
        ])
      : clean([
          [
            fields.kind === 'comprehensive'
              ? 'insuranceComprehensiveExpiry'
              : 'insuranceCompulsoryExpiry',
            isDate(fields.valid_until) ? fields.valid_until : null,
          ],
        ]);
  const invalid = Object.entries({ plateNumber: 'plate', vin: 'vin', modelYear: 'year' })
    .filter(([key, check]) => values[key] != null && fieldError(check, values[key]))
    .map(([key]) => key);
  // A document of another vehicle: said, not silently applied.
  const otherVehicle =
    Boolean(fields.plate_number && current.plateNumber) &&
    !samePlate(fields.plate_number, current.plateNumber);
  return { values, invalid, otherVehicle };
};

// Driving license -> driver attributes (and the name, only when the form has none).
export const driverValues = (fields, current = {}) => {
  const classes = (fields.license_classes || [])
    .map((value) => String(value).trim().toUpperCase())
    .map((value) => LICENSE_CLASSES.find((option) => option.toUpperCase() === value))
    .filter(Boolean);
  const values = clean([
    [
      'nationalId',
      fields.national_id && isValidIsraeliId(fields.national_id)
        ? normalizeIsraeliId(fields.national_id)
        : fields.national_id,
    ],
    ['licenseNumber', fields.license_number],
    ['licenseClasses', classes.length ? classes : null],
    ['licenseExpiry', isDate(fields.expiry) ? fields.expiry : null],
  ]);
  const invalid = values.nationalId && !isValidIsraeliId(values.nationalId) ? ['nationalId'] : [];
  return { values, invalid, name: current.name ? null : fields.full_name || null };
};

// Garage invoice -> work order lines and number.
export const invoiceValues = (fields) => {
  const lines = (fields.lines || [])
    .filter((line) => line.description)
    .map((line) => {
      const quantity = Number(line.quantity) > 0 ? Number(line.quantity) : 1;
      const amount = Number(line.amount) || 0;
      return {
        key: crypto.randomUUID(),
        kind: line.kind === 'labor' ? 'labor' : line.kind === 'part' ? 'part' : 'fee',
        description: String(line.description).slice(0, 200),
        quantity,
        unit_price: Math.round((amount / quantity) * 100) / 100,
      };
    });
  const sum = lines.reduce((total, line) => total + line.quantity * line.unit_price, 0);
  // Lines that do not add up to the total before VAT are worth a second look.
  const mismatch =
    fields.subtotal != null && Math.abs(sum - Number(fields.subtotal)) > 1 ? true : false;
  return {
    invoiceNumber: fields.invoice_number || null,
    lines,
    total: fields.total ?? null,
    mismatch,
  };
};
