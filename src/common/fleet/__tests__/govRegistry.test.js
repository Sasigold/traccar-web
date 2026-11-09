import { describe, expect, it } from 'vitest';
import { plateDigits, registryChanges, registryToFields, validPlate } from '../govRegistry';

// A real record shape from data.gov.il (values changed).
const record = {
  mispar_rechev: 75128203,
  tozeret_nm: "מ.ג'י סין",
  degem_nm: 'WS43',
  kinuy_mishari: 'ZS',
  shnat_yitzur: 2025,
  misgeret: 'LSJWS4393RZ309720',
  sug_delek_nm: 'בנזין',
  baalut: 'פרטי',
  mivchan_acharon_dt: '2025-01-07',
  tokef_dt: '2027-01-06',
};

describe('government vehicle registry', () => {
  it('reads plates with or without separators', () => {
    expect(plateDigits('12-345-67')).toBe('1234567');
    expect(validPlate('12-345-67')).toBe(true);
    expect(validPlate('751-28-203')).toBe(true);
    expect(validPlate('ABC')).toBe(false);
    expect(validPlate('123')).toBe(false);
  });

  it('maps a record to card fields', () => {
    expect(registryToFields(record)).toEqual({
      make: "מ.ג'י סין",
      vehicleModel: 'ZS',
      modelYear: 2025,
      vin: 'LSJWS4393RZ309720',
      fuelType: 'petrol',
      ownership: 'owned',
      testExpiry: '2027-01-06',
    });
  });

  it('understands fuel and ownership wording', () => {
    const fuel = (name) => registryToFields({ sug_delek_nm: name }).fuelType;
    expect(fuel('דיזל')).toBe('diesel');
    expect(fuel('חשמל')).toBe('electric');
    expect(fuel('חשמל/בנזין')).toBe('hybrid');
    expect(fuel('גפ"מ')).toBe('gas');
    const owner = (name) => registryToFields({ baalut: name }).ownership;
    expect(owner('ליסינג')).toBe('leased');
    expect(owner('השכרה')).toBe('rented');
    expect(owner('חברה')).toBe('owned');
  });

  it('lists only what would change', () => {
    const fields = registryToFields(record);
    const changes = registryChanges({ make: "מ.ג'י סין", modelYear: '2024' }, fields);
    expect(changes.map((change) => change.key)).toEqual([
      'vehicleModel',
      'modelYear',
      'vin',
      'fuelType',
      'ownership',
      'testExpiry',
    ]);
    expect(changes.find((change) => change.key === 'modelYear')).toEqual({
      key: 'modelYear',
      from: '2024',
      to: 2025,
    });
  });
});
