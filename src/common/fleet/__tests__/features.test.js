import { describe, expect, it, vi } from 'vitest';
import { hasFleetFeature, loadFleetFeatures } from '../features';

const client = ({ rpc, tables = [] }) => ({
  rpc: vi.fn(async () => rpc),
  from: (table) => ({
    select: () => ({
      limit: async () =>
        tables.includes(table)
          ? { data: [], error: null }
          : { data: null, error: { code: 'PGRST205', message: 'not found' } },
    }),
  }),
});

describe('fleet features (ADM-08)', () => {
  it('takes the list from fleet_features()', async () => {
    expect(
      await loadFleetFeatures(client({ rpc: { data: ['dispatch', 'poi'], error: null } })),
    ).toEqual(['dispatch', 'poi']);
  });

  it('probes the tables on a database without the function', async () => {
    const features = await loadFleetFeatures(
      client({
        rpc: { data: null, error: { code: 'PGRST202' } },
        tables: ['work_orders', 'incidents'],
      }),
    );
    expect(features).toEqual(['workOrders', 'incidents']);
  });

  it('stays unknown on other errors and empty answers, which hide nothing', async () => {
    expect(
      await loadFleetFeatures(client({ rpc: { data: null, error: { code: '500' } } })),
    ).toBeNull();
    expect(await loadFleetFeatures(client({ rpc: { data: [], error: null } }))).toBeNull();
    expect(hasFleetFeature(null, 'dispatch')).toBe(true);
    expect(hasFleetFeature(['poi'], 'dispatch')).toBe(false);
  });
});
