import { describe, expect, it } from 'vitest';
import {
  buildInvoiceDraft,
  effectiveTerms,
  invoiceState,
  invoiceTotals,
  monthlyAmount,
  periodFor,
} from '../billing';
import {
  applySensors,
  computedForSensors,
  fuelCalibration,
  planComputedSync,
  sensorProblem,
  sensorReading,
} from '../sensors';
import { compactProfile } from '../../common/components/telemetry/vehicleProfile';

const plan = { price_per_device: 39, base_price: 50, cycle: 'monthly' };
const labels = { base: 'base', devices: 'devices', discount: 'discount {0}%' };

describe('billing', () => {
  it('uses subscription overrides before the plan', () => {
    expect(effectiveTerms({ price_per_device: 30, base_price: null }, plan)).toEqual({
      perDevice: 30,
      base: 50,
      discount: 0,
      cycle: 'monthly',
    });
  });

  it('computes monthly revenue with discount, and zero when not active', () => {
    expect(monthlyAmount({ status: 'active', discount_percent: 10 }, plan, 10)).toBe(396);
    expect(monthlyAmount({ status: 'paused' }, plan, 10)).toBe(0);
  });

  it('aligns periods to calendar months and quarters', () => {
    expect(periodFor(new Date(2026, 10, 4))).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodFor(new Date(2026, 10, 4), 'quarterly')).toEqual({
      start: '2026-10-01',
      end: '2026-12-31',
    });
    expect(periodFor(new Date(2028, 1, 10))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('builds a draft bill with base, devices and discount lines', () => {
    const { invoice, lines } = buildInvoiceDraft({
      customerId: 'c1',
      subscription: { status: 'active', discount_percent: 10, payment_terms_days: 14 },
      plan,
      billableDevices: 4,
      period: { start: '2026-11-01', end: '2026-11-30' },
      issueDate: '2026-11-04',
      labels,
    });
    expect(invoice.due_date).toBe('2026-11-18');
    expect(lines.map((line) => [line.description, line.quantity, line.unit_price])).toEqual([
      ['base', 1, 50],
      ['devices', 4, 39],
      ['discount 10%', 1, -20.6],
    ]);
    expect(invoiceTotals(lines)).toEqual({ subtotal: 185.4, vat: 33.37, total: 218.77 });
  });

  it('bills a quarter as three months of devices', () => {
    const { lines } = buildInvoiceDraft({
      customerId: 'c1',
      subscription: { status: 'active', cycle: 'quarterly' },
      plan: { price_per_device: 39, base_price: 0 },
      billableDevices: 2,
      period: { start: '2026-10-01', end: '2026-12-31' },
      issueDate: '2026-10-01',
      labels,
    });
    expect(lines).toEqual([{ description: 'devices', quantity: 6, unit_price: 39, sort_order: 0 }]);
  });

  it('marks issued bills past due as overdue', () => {
    expect(invoiceState({ status: 'issued', due_date: '2026-11-01' }, '2026-11-04')).toBe(
      'overdue',
    );
    expect(invoiceState({ status: 'issued', due_date: '2026-11-10' }, '2026-11-04')).toBe('issued');
    expect(invoiceState({ status: 'paid', due_date: '2026-11-01' }, '2026-11-04')).toBe('paid');
  });
});

describe('sensors', () => {
  it('calibrates a raw fuel sensor from empty and full readings', () => {
    expect(fuelCalibration(200, 3200, 300)).toEqual({ factor: 0.1, offset: -20 });
    expect(fuelCalibration(10, 10, 300)).toBeNull();
  });

  it('writes labels, fuel and tires into the profile and keeps manual tweaks', () => {
    const profile = { params: { rpm: { factor: 2 } } };
    const sensors = [
      { id: 'a', type: 'temperature', source: 'temp1', label: 'Fridge' },
      { id: 'b', type: 'fuel', source: 'adc1', unit: 'raw', empty: 200, full: 3200, capacity: 300 },
      { id: 'c', type: 'tires', show: 'on' },
    ];
    const result = applySensors(profile, sensors, () => 'Fuel');
    expect(result.params).toEqual({
      rpm: { factor: 2 },
      temp1: { sensor: 'a', label: 'Fridge' },
      adc1: { sensor: 'b', label: 'Fuel', factor: 0.1, offset: -20 },
    });
    expect(result.fuel).toEqual({ source: 'adc1', unit: 'liters' });
    expect(result.tires).toEqual({ show: 'on' });

    const removed = applySensors(result, []);
    expect(removed.params).toEqual({ rpm: { factor: 2 } });
    expect(removed.fuel).toBeUndefined();
    expect(removed.tires).toBeUndefined();
    expect(removed.sensors).toBeUndefined();
  });

  it('survives the dashboard profile compaction', () => {
    const result = applySensors({}, [
      { id: 'a', type: 'temperature', source: 'temp1', label: 'X' },
    ]);
    expect(compactProfile(result).sensors).toHaveLength(1);
  });

  it('turns wired inputs into computed attributes', () => {
    const sensors = [
      { id: 'a', type: 'ignition', input: 'in2' },
      { id: 'b', type: 'panic', input: 'in4' },
      { id: 'c', type: 'door', input: 'auto' },
      { id: 'd', type: 'door', input: 'in1; drop' },
    ];
    expect(computedForSensors(sensors, 7)).toEqual([
      {
        attribute: 'ignition',
        expression: 'in2',
        type: 'boolean',
        description: '[vf:7] ignition ← in2',
      },
      {
        attribute: 'alarm',
        expression: 'in4 ? "sos" : null',
        type: 'string',
        description: '[vf:7] panic ← in4',
      },
    ]);
  });

  it('plans create, update and remove against what Traccar has', () => {
    const linked = [
      {
        id: 1,
        attribute: 'ignition',
        expression: 'in1',
        type: 'boolean',
        description: '[vf:7] ignition ← in1',
      },
      {
        id: 2,
        attribute: 'door',
        expression: 'in3',
        type: 'boolean',
        description: '[vf:7] door ← in3',
      },
      { id: 3, attribute: 'door', expression: 'in3', type: 'boolean', description: 'someone else' },
    ];
    const desired = computedForSensors(
      [
        { id: 'a', type: 'ignition', input: 'in2' },
        { id: 'b', type: 'panic', input: 'in4' },
      ],
      7,
    );
    const plan = planComputedSync(linked, desired, 7);
    expect(plan.create.map((item) => item.attribute)).toEqual(['alarm']);
    expect(plan.update.map((item) => [item.id, item.expression])).toEqual([[1, 'in2']]);
    expect(plan.remove.map((item) => item.id)).toEqual([2]);
  });

  it('flags incomplete sensors and reads live values', () => {
    expect(sensorProblem({ type: 'temperature', source: '' })).toBe('adminSensorNeedSource');
    expect(sensorProblem({ type: 'fuel', source: 'adc1', unit: 'raw' })).toBe(
      'adminSensorNeedCalibration',
    );
    const position = { attributes: { adc1: 1700, in2: true } };
    expect(
      sensorReading(
        { type: 'fuel', source: 'adc1', unit: 'raw', empty: 200, full: 3200, capacity: 300 },
        position,
      ),
    ).toBe(150);
    expect(sensorReading({ type: 'ignition', input: 'in2' }, position)).toBe(true);
  });
});
