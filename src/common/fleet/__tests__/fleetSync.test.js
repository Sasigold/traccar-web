import { describe, expect, it } from 'vitest';
import {
  driverAttributes,
  driverRow,
  hasFleetDetails,
  latestExpiries,
  mergeDocumentExpiries,
  planDocumentSync,
  vehicleAttributes,
  vehicleRow,
} from '../fleetSync';

const device = {
  id: 7,
  name: 'Truck',
  attributes: {
    plateNumber: '12-345-67',
    vehicleModel: 'Transit',
    modelYear: 2022,
    fuelType: 'diesel',
    leaseEndDate: '2027-03-01',
    testExpiry: '2027-01-01',
    speedLimit: 27,
  },
};

describe('fleet sync rows', () => {
  it('maps a device to a vehicle row, falling back to the name for the plate', () => {
    expect(vehicleRow(device)).toMatchObject({
      traccar_device_id: 7,
      plate_number: '12-345-67',
      model: 'Transit',
      year: 2022,
      fuel_type: 'diesel',
      leasing_end_date: '2027-03-01',
      vin: null,
    });
    expect(vehicleRow({ id: 1, name: 'Van', attributes: { modelYear: 'abc' } })).toMatchObject({
      plate_number: 'Van',
      year: null,
    });
  });

  it('maps a driver, including status and license classes', () => {
    const row = driverRow({
      id: 3,
      name: 'Dana',
      uniqueId: 'X1',
      attributes: {
        driverStatus: 'ended',
        licenseClasses: ['C1', 'B'],
        licenseExpiry: '2027-02-02',
      },
    });
    expect(row).toMatchObject({
      traccar_driver_id: 3,
      full_name: 'Dana',
      status: 'inactive',
      license_classes: ['C1', 'B'],
      license_class: 'C1',
      license_expiry: '2027-02-02',
    });
    expect(driverRow({ id: 4, uniqueId: 'K9', attributes: {} })).toMatchObject({
      full_name: 'K9',
      status: null,
      license_classes: [],
    });
  });

  it('lays database values over attributes, keeping unrelated ones', () => {
    const merged = vehicleAttributes(
      device.attributes,
      { plate_number: '99-999-99', model: null, year: 2023 },
      [
        { document_type: 'vehicle_test', expires_at: '2026-12-01' },
        { document_type: 'vehicle_test', expires_at: '2027-06-01' },
      ],
    );
    expect(merged).toMatchObject({
      plateNumber: '99-999-99',
      vehicleModel: 'Transit',
      modelYear: 2023,
      testExpiry: '2027-06-01',
      speedLimit: 27,
    });
    expect(
      driverAttributes({}, { status: 'inactive', license_classes: [], license_class: 'B' }),
    ).toEqual({ driverStatus: 'ended', licenseClasses: ['B'] });
  });

  it('finds the latest expiry per type', () => {
    expect(
      latestExpiries([
        { document_type: 'a', expires_at: '2026-01-01' },
        { document_type: 'a', expires_at: '2027-01-01' },
        { document_type: 'b', expires_at: null },
      ]),
    ).toEqual({ a: '2027-01-01' });
  });

  it('detects whether a card has fleet details', () => {
    expect(hasFleetDetails({ speedLimit: 1 }, ['plateNumber'])).toBe(false);
    expect(hasFleetDetails({ plateNumber: '1' }, ['plateNumber'])).toBe(true);
  });
});

describe('validity documents', () => {
  const attributes = {
    testExpiry: '2027-01-01',
    insuranceCompulsoryExpiry: '2026-12-01',
    insuranceComprehensiveExpiry: '2026-11-30',
    leaseEndDate: '',
  };

  it('inserts, moves or adds documents, and never deletes', () => {
    const documents = [
      { id: 'a', document_type: 'vehicle_test', expires_at: '2026-06-01', file_path: null },
      {
        id: 'b',
        document_type: 'insurance_mandatory',
        expires_at: '2025-12-01',
        file_path: 'x.pdf',
      },
      {
        id: 'c',
        document_type: 'insurance_comprehensive',
        expires_at: '2026-11-30',
        file_path: null,
      },
      { id: 'd', document_type: 'lease_agreement', expires_at: '2028-01-01', file_path: null },
    ];
    expect(planDocumentSync('vehicle', attributes, documents)).toEqual({
      update: [{ id: 'a', expires_at: '2027-01-01' }],
      insert: [{ document_type: 'insurance_mandatory', expires_at: '2026-12-01' }],
    });
  });

  it('creates the driving license document for a new driver', () => {
    expect(planDocumentSync('driver', { licenseExpiry: '2027-02-02' }, [])).toEqual({
      update: [],
      insert: [{ document_type: 'driver_license', expires_at: '2027-02-02' }],
    });
  });
});

describe('merging database documents into validity rows', () => {
  const options = {
    labelKeys: { testExpiry: 'fleetTestExpiry' },
    statusOf: (value) => (value < '2026-11-06' ? 'expired' : 'valid'),
    daysOf: (value) => (value < '2026-11-06' ? -1 : 100),
  };
  const rows = [
    { id: 'r1', entity: 'vehicle', entityId: 7, field: 'testExpiry', date: '2027-01-01', days: 50 },
  ];

  it('skips duplicates, organization documents and unlinked rows, and labels the rest', () => {
    const merged = mergeDocumentExpiries(
      rows,
      [
        {
          id: 'a',
          entity: 'vehicle',
          traccar_device_id: 7,
          document_type: 'vehicle_test',
          expires_at: '2027-01-01',
        },
        {
          id: 'b',
          entity: 'driver',
          traccar_driver_id: 3,
          document_type: 'driver_medical',
          expires_at: '2026-01-01',
          label_he: 'אישור רפואי',
          label_en: 'Medical',
          driver_name: 'Dana',
          file_path: 'm.pdf',
        },
        {
          id: 'c',
          entity: 'organization',
          document_type: 'org_operator_license',
          expires_at: '2026-01-01',
        },
        {
          id: 'd',
          entity: 'vehicle',
          traccar_device_id: null,
          document_type: 'vehicle_test',
          expires_at: '2026-01-01',
        },
      ],
      options,
    );
    expect(merged.map((row) => row.id)).toEqual(['document-b', 'r1']);
    expect(merged[0]).toMatchObject({
      entity: 'driver',
      entityId: 3,
      name: 'Dana',
      labels: { label_he: 'אישור רפואי', label_en: 'Medical' },
      status: 'expired',
      hasFile: true,
    });
  });
});

describe('renewed documents', () => {
  it('keeps only the latest date per vehicle and type, across both sources', () => {
    const merged = mergeDocumentExpiries(
      [
        {
          id: 'r1',
          entity: 'vehicle',
          entityId: 7,
          field: 'testExpiry',
          date: '2026-10-01',
          days: -36,
        },
      ],
      [
        {
          id: 'a',
          entity: 'vehicle',
          traccar_device_id: 7,
          document_type: 'vehicle_test',
          expires_at: '2027-10-01',
        },
        {
          id: 'b',
          entity: 'driver',
          traccar_driver_id: 3,
          document_type: 'driver_medical',
          expires_at: '2025-01-01',
        },
        {
          id: 'c',
          entity: 'driver',
          traccar_driver_id: 3,
          document_type: 'driver_medical',
          expires_at: '2027-01-01',
        },
      ],
      { labelKeys: {}, statusOf: () => 'valid', daysOf: (value) => Number(value.slice(0, 4)) },
    );
    expect(merged.map((row) => [row.id, row.date])).toEqual(
      [
        ['document-a', '2027-10-01'],
        ['document-c', '2027-01-01'],
      ].sort((x, y) => Number(x[1].slice(0, 4)) - Number(y[1].slice(0, 4))),
    );
  });
});
