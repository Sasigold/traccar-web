import { describe, expect, it } from 'vitest';
import { itemTotal, itemsTotal, odometerKm, statusChange } from '../workOrders';

describe('work orders', () => {
  it('totals lines to the agora', () => {
    expect(itemTotal({ quantity: 1.5, unit_price: 199.99 })).toBe(299.99);
    expect(
      itemsTotal([{ quantity: 5, unit_price: 40 }, { quantity: '1.5', unit_price: '200' }, {}]),
    ).toBe(500);
  });

  it('records shop entry and closing once', () => {
    const now = new Date('2026-11-06T10:00:00Z');
    expect(statusChange({}, 'in_shop', now)).toEqual({
      status: 'in_shop',
      in_shop_at: '2026-11-06T10:00:00.000Z',
      closed_at: null,
    });
    expect(statusChange({ in_shop_at: 'x' }, 'done', now)).toEqual({
      status: 'done',
      closed_at: '2026-11-06T10:00:00.000Z',
    });
    expect(statusChange({ closed_at: 'earlier' }, 'done', now).closed_at).toBe('earlier');
    expect(statusChange({ closed_at: 'earlier' }, 'open', now).closed_at).toBeNull();
  });

  it('reads the odometer in km', () => {
    expect(odometerKm({ attributes: { totalDistance: 123456789 } })).toBe(123457);
    expect(odometerKm({ attributes: {} })).toBeNull();
  });
});
