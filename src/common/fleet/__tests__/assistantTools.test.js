import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../util/fetchOrThrow', () => ({ default: vi.fn() }));
vi.mock('../privacyData', () => ({
  privateRows: vi.fn(async (rows) => ({
    rows: rows.map((row) => (row.secret ? { ...row, privacy: 'private' } : row)),
    hidden: rows.filter((row) => row.secret).length,
  })),
}));

const fetchOrThrow = (await import('../../util/fetchOrThrow')).default;
const { TOOLS, reportLinkOf, runToolCalls } = await import('../assistantTools');

const store = {
  devices: {
    1: {
      id: 1,
      name: 'טנדר',
      status: 'online',
      attributes: { plateNumber: '12-345-67', testExpiry: '2026-11-20' },
    },
    2: { id: 2, name: 'משאית', status: 'offline', groupId: 5, attributes: {} },
  },
  positions: { 1: { attributes: { driverUniqueId: 'd1' } } },
  groups: { 5: { name: 'צפון' } },
  drivers: { d1: { id: 1, name: 'דנה', attributes: {} } },
};
const period = { from: '2026-11-01T00:00:00Z', to: '2026-11-08T00:00:00Z' };

describe('assistant tools (AI-01)', () => {
  beforeEach(() => fetchOrThrow.mockReset());

  it('lists the vehicles the user sees', async () => {
    expect(await TOOLS.list_vehicles({}, store)).toEqual([
      expect.objectContaining({ id: 1, plate: '12-345-67', driver: 'דנה' }),
      expect.objectContaining({ id: 2, group: 'צפון', driver: null }),
    ]);
  });

  it('asks Traccar for the whole fleet when no vehicle is named, in km and hours', async () => {
    fetchOrThrow.mockResolvedValue({
      json: async () => [{ deviceId: 2, distance: 12345, engineHours: 5400000, maxSpeed: 50 }],
    });
    const rows = await TOOLS.fleet_summary({ period, vehicle_ids: [] }, store);
    expect(fetchOrThrow.mock.calls[0][0]).toMatch(/api\/reports\/summary\?.*deviceId=1&deviceId=2/);
    expect(rows[0]).toMatchObject({
      vehicle: 'משאית',
      distance_km: 12.3,
      engine_hours: 1.5,
      max_speed_kmh: 93,
    });
  });

  it('keeps what privacy hides away from the model', async () => {
    fetchOrThrow.mockResolvedValue({
      json: async () => [
        { deviceId: 1, distance: 1000, startAddress: 'A' },
        { deviceId: 1, distance: 2000, startAddress: 'home', secret: true },
      ],
    });
    const result = await TOOLS.trips({ period, vehicle_ids: [1] }, store);
    expect(result.rows.map((row) => row.from)).toEqual(['A']);
    expect(result.hidden_by_privacy).toBe(1);
  });

  it('refuses a period that is wrong or too long', async () => {
    await expect(TOOLS.trips({ period: { from: 'x', to: 'y' } }, store)).rejects.toThrow();
    await expect(
      TOOLS.trips({ period: { from: '2026-01-01T00:00:00Z', to: '2026-12-01T00:00:00Z' } }, store),
    ).rejects.toThrow(/93 days/);
  });

  it('answers every call, and reports a failing tool to the model', async () => {
    const results = await runToolCalls(
      [
        { type: 'text', text: 'checking' },
        { type: 'tool_use', id: 'a', name: 'list_vehicles', input: {} },
        { type: 'tool_use', id: 'b', name: 'drop_tables', input: {} },
        { type: 'tool_use', id: 'c', name: 'show_table', input: { columns: [], rows: [] } },
      ],
      store,
    );
    expect(results.map((result) => [result.tool_use_id, Boolean(result.is_error)])).toEqual([
      ['a', false],
      ['b', true],
      ['c', false],
    ]);
  });

  it('turns a data call into the matching report link', () => {
    expect(reportLinkOf({ name: 'trips', input: { period, vehicle_ids: [1] } })).toBe(
      '/reports/trips?from=2026-11-01T00%3A00%3A00Z&to=2026-11-08T00%3A00%3A00Z&deviceId=1',
    );
    expect(reportLinkOf({ name: 'list_vehicles', input: {} })).toBeNull();
  });
});
