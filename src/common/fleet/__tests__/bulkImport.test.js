import { describe, expect, it } from 'vitest';
import { buildImportRows, guessImportColumns, importEntity } from '../bulkImport';

describe('import from a spreadsheet (ADM-13)', () => {
  it('guesses the vehicle columns from Hebrew headers', () => {
    expect(
      guessImportColumns('vehicles', ['שם הרכב', 'מספר רישוי', 'IMEI', 'קבוצה', 'תוקף טסט', 'דגם']),
    ).toEqual({
      name: 0,
      plateNumber: 1,
      uniqueId: 2,
      group: 3,
      testExpiry: 4,
      vehicleModel: 5,
    });
  });

  it('checks each row like the forms, and skips what already exists', () => {
    const mapping = { name: 0, plateNumber: 1, uniqueId: 2, testExpiry: 3 };
    const rows = buildImportRows(
      'vehicles',
      [
        ['טנדר 12', '1234567', '490154203237518', '1/3/2027'],
        ['משאית', '12', '860001', ''],
        ['', '2345678', '860002', 'אתמול'],
        ['כפול', '7654321', '860003', ''],
        ['כפול שוב', '', '860003', ''],
        ['ישן', '89-012-34', '860009', ''],
        ['IMEI שגוי', '', '490154203237519', ''],
      ],
      mapping,
      { identifiers: new Set(['860009']), plates: new Set() },
    );
    expect(rows[0]).toMatchObject({
      line: 2,
      errors: [],
      duplicate: null,
      values: { plateNumber: '12-345-67', testExpiry: '2027-03-01' },
    });
    expect(rows[1].errors.map((error) => error.key)).toEqual(['validationPlate']);
    expect(rows[2].errors.map((error) => error.key).sort()).toEqual([
      'importBadDate',
      'importRequired',
    ]);
    expect(rows[4].duplicate).toBe('importTwiceInFile');
    expect(rows[5].duplicate).toBe('importExists');
    expect(rows[6].errors.map((error) => error.key)).toEqual(['validationImei']);
  });

  it("checks drivers' ID numbers and phones, and points' coordinates", () => {
    const [driver] = buildImportRows('drivers', [['דנה', '1001', '123456782', '050-1234567']], {
      name: 0,
      uniqueId: 1,
      nationalId: 2,
      phone: 3,
    });
    expect(driver.errors).toEqual([]);
    expect(driver.values.phone).toBe('+972501234567');
    const [bad] = buildImportRows('drivers', [['יוסי', '1002', '123456789']], {
      name: 0,
      uniqueId: 1,
      nationalId: 2,
    });
    expect(bad.errors.map((error) => error.key)).toEqual(['validationIsraeliId']);
    const [poi] = buildImportRows('pois', [['מחסן', '132.1', '34.8']], {
      name: 0,
      latitude: 1,
      longitude: 2,
    });
    expect(poi.errors.map((error) => error.key)).toEqual(['importBadNumber']);
  });

  it('makes Traccar devices with the group by name', () => {
    expect(
      importEntity(
        'vehicles',
        { name: 'טנדר', uniqueId: 860001, plateNumber: '1234567', group: 'צפון' },
        { groups: { צפון: 4 } },
      ),
    ).toEqual({
      name: 'טנדר',
      uniqueId: '860001',
      phone: null,
      model: null,
      groupId: 4,
      attributes: { plateNumber: '12-345-67' },
    });
  });
});
