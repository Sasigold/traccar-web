import { describe, expect, it } from 'vitest';
import { driverValues, invoiceValues, vehicleValues } from '../documentScan';

describe('scanned documents fill the forms (AI-04)', () => {
  it('a vehicle license fills the vehicle, and flags what fails the checks', () => {
    const result = vehicleValues(
      'vehicle_license',
      {
        plate_number: '1234567',
        test_expiry: '2027-03-01',
        make: 'Ford',
        model: 'Transit',
        model_year: 1890,
        vin: null,
      },
      { plateNumber: '12-345-67' },
    );
    expect(result.values).toEqual({
      plateNumber: '12-345-67',
      testExpiry: '2027-03-01',
      make: 'Ford',
      vehicleModel: 'Transit',
      modelYear: 1890,
    });
    expect(result.invalid).toEqual(['modelYear']);
    expect(result.otherVehicle).toBe(false);
  });

  it('a policy of another vehicle is said, and sets the right expiry', () => {
    const result = vehicleValues(
      'insurance',
      { plate_number: '7654321', kind: 'comprehensive', valid_until: '2027-01-31' },
      { plateNumber: '12-345-67' },
    );
    expect(result.values).toEqual({ insuranceComprehensiveExpiry: '2027-01-31' });
    expect(result.otherVehicle).toBe(true);
  });

  it('a driving license fills the license fields, the name only when empty', () => {
    const result = driverValues(
      {
        full_name: 'דנה לוי',
        national_id: '123456782',
        license_number: '9876543',
        license_classes: ['b', 'C1', 'Z'],
        expiry: '2030-05-01',
      },
      { name: '' },
    );
    expect(result.values).toEqual({
      nationalId: '123456782',
      licenseNumber: '9876543',
      licenseClasses: ['B', 'C1'],
      licenseExpiry: '2030-05-01',
    });
    expect(result.name).toBe('דנה לוי');
    expect(driverValues({ national_id: '123456789' }, { name: 'x' }).invalid).toEqual([
      'nationalId',
    ]);
  });

  it('a garage invoice becomes work order lines', () => {
    const result = invoiceValues({
      invoice_number: 'A-77',
      lines: [
        { description: 'רפידות', kind: 'part', quantity: 2, amount: 400 },
        { description: 'עבודה', kind: 'labor', quantity: null, amount: 250 },
      ],
      subtotal: 650,
      total: 760.5,
    });
    expect(result.lines.map((line) => [line.kind, line.quantity, line.unit_price])).toEqual([
      ['part', 2, 200],
      ['labor', 1, 250],
    ]);
    expect(result.mismatch).toBe(false);
    expect(
      invoiceValues({ lines: [{ description: 'x', amount: 10 }], subtotal: 99 }).mismatch,
    ).toBe(true);
  });
});
