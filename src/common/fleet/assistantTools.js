import fetchOrThrow from '../util/fetchOrThrow';
import { getFleetClient, unwrap } from './client';
import { collectExpiries } from './fleetFields';
import { privateRows } from './privacyData';

// AI-01: the tools the fleet assistant may use, run here in the browser with the user's own
// permissions (Traccar's REST API and the fleet database's row security), never free SQL.
// Each returns a compact JSON-friendly value; the model sees only that.

const KNOTS_TO_KMH = 1.852;
const MAX_ROWS = 150;
const round = (value, digits = 1) =>
  value == null || Number.isNaN(Number(value)) ? null : Number(Number(value).toFixed(digits));
const hours = (ms) => round((ms || 0) / 3600000, 2);
const km = (meters) => round((meters || 0) / 1000, 1);
const kmh = (knots) => round((knots || 0) * KNOTS_TO_KMH, 0);

const ids = (input, store) =>
  input.vehicle_ids?.length
    ? input.vehicle_ids.filter((id) => store.devices[id])
    : Object.keys(store.devices).map(Number);

const period = (input) => {
  const from = new Date(input.period?.from);
  const to = new Date(input.period?.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    throw new Error('invalid period');
  }
  if (to - from > 93 * 86400000) {
    throw new Error('period longer than 93 days');
  }
  return { from: from.toISOString(), to: to.toISOString() };
};

const report = async (kind, input, store, extra = {}) => {
  const { from, to } = period(input);
  const deviceIds = ids(input, store);
  if (!deviceIds.length) return { rows: [], deviceIds, from, to };
  const query = new URLSearchParams({ from, to });
  deviceIds.forEach((id) => query.append('deviceId', id));
  Object.entries(extra).forEach(([key, values]) =>
    values.forEach((value) => query.append(key, value)),
  );
  const response = await fetchOrThrow(`api/reports/${kind}?${query}`, {
    headers: { Accept: 'application/json' },
  });
  return { rows: await response.json(), deviceIds, from, to };
};

const nameOf = (store, deviceId) => store.devices[deviceId]?.name ?? String(deviceId);
const limited = (rows) =>
  rows.length > MAX_ROWS
    ? { rows: rows.slice(0, MAX_ROWS), more: rows.length - MAX_ROWS }
    : { rows };

// What the user's privacy rules hide stays hidden from the model too.
const withoutHidden = async ({ rows, deviceIds, from, to }) => {
  const result = await privateRows(rows, { deviceIds, from, to, view: 'report' });
  return { rows: result.rows.filter((row) => !row.privacy), hidden: result.hidden };
};

export const TOOLS = {
  list_vehicles: async (_, store) =>
    Object.values(store.devices).map((device) => {
      const position = store.positions[device.id];
      return {
        id: device.id,
        name: device.name,
        plate: device.attributes?.plateNumber ?? null,
        group: store.groups[device.groupId]?.name ?? null,
        status: device.status,
        last_update: device.lastUpdate,
        driver: store.drivers[position?.attributes?.driverUniqueId]?.name ?? null,
      };
    }),

  fleet_summary: async (input, store) => {
    const data = await report('summary', input, store);
    return data.rows.map((row) => ({
      vehicle: nameOf(store, row.deviceId),
      vehicle_id: row.deviceId,
      distance_km: km(row.distance),
      engine_hours: hours(row.engineHours),
      max_speed_kmh: kmh(row.maxSpeed),
      average_speed_kmh: kmh(row.averageSpeed),
      fuel_l: round(row.spentFuel),
    }));
  },

  trips: async (input, store) => {
    const { rows, hidden } = await withoutHidden(await report('trips', input, store));
    return {
      ...limited(
        rows.map((row) => ({
          vehicle: nameOf(store, row.deviceId),
          start: row.startTime,
          end: row.endTime,
          from: row.startAddress ?? null,
          to: row.endAddress ?? null,
          distance_km: km(row.distance),
          duration_h: hours(row.duration),
          max_speed_kmh: kmh(row.maxSpeed),
          driver: row.driverName ?? null,
        })),
      ),
      hidden_by_privacy: hidden,
    };
  },

  stops: async (input, store) => {
    const { rows, hidden } = await withoutHidden(await report('stops', input, store));
    return {
      ...limited(
        rows.map((row) => ({
          vehicle: nameOf(store, row.deviceId),
          start: row.startTime,
          end: row.endTime,
          duration_h: hours(row.duration),
          address: row.address ?? null,
        })),
      ),
      hidden_by_privacy: hidden,
    };
  },

  events: async (input, store) => {
    const data = await report('events', input, store, {
      type: input.types?.length ? input.types : ['allEvents'],
    });
    return limited(
      data.rows.map((row) => ({
        vehicle: nameOf(store, row.deviceId),
        type: row.type,
        time: row.eventTime,
        alarm: row.attributes?.alarm ?? null,
      })),
    );
  },

  expiries: async (input, store) => {
    const within = Math.min(Math.max(Number(input.within_days) || 0, 0), 365);
    return collectExpiries(Object.values(store.devices), Object.values(store.drivers))
      .filter((row) => row.days <= within)
      .map((row) => ({
        kind: row.entity,
        name: row.name,
        plate: row.plateNumber ?? null,
        what: row.field,
        date: row.date,
        days_left: row.days,
      }));
  },

  costs: async (input) => {
    const { from, to } = period(input);
    const rows =
      unwrap(
        await getFleetClient()
          .from('vehicle_monthly_costs')
          .select('vehicle_id, month, category, amount, vehicles(plate_number)')
          .gte('month', from.slice(0, 7) + '-01')
          .lte('month', to.slice(0, 10)),
      ) || [];
    return limited(
      rows.map((row) => ({
        plate: row.vehicles?.plate_number ?? null,
        month: row.month,
        category: row.category,
        amount_ils: round(row.amount, 0),
      })),
    );
  },
};

// Tools that only draw on the screen.
export const SCREEN_TOOLS = ['show_table', 'suggest_followups'];

// Runs the tool calls of one model turn; each becomes a tool_result block. A failing tool is
// reported to the model as an error instead of stopping the conversation.
export const runToolCalls = async (blocks, store) =>
  Promise.all(
    blocks
      .filter((block) => block.type === 'tool_use')
      .map(async (block) => {
        if (SCREEN_TOOLS.includes(block.name)) {
          return { type: 'tool_result', tool_use_id: block.id, content: 'shown' };
        }
        const tool = TOOLS[block.name];
        try {
          if (!tool) throw new Error('unknown tool');
          const value = await tool(block.input || {}, store);
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(value).slice(0, 60000),
          };
        } catch (error) {
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            is_error: true,
            content: error?.message || 'failed',
          };
        }
      }),
  );

// The report screen that shows what a data tool fetched, for "open as a report".
export const reportLinkOf = (block) => {
  const paths = { fleet_summary: 'summary', trips: 'trips', stops: 'stops', events: 'events' };
  const path = paths[block?.name];
  if (!path || !block.input?.period) return null;
  const query = new URLSearchParams({ from: block.input.period.from, to: block.input.period.to });
  (block.input.vehicle_ids || []).forEach((id) => query.append('deviceId', id));
  return `/reports/${path}?${query}`;
};
