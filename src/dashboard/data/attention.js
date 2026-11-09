import { violationUrgency } from '../../common/fleet/violations';

// "Needs attention now" (REP-24): one ranked list of what is urgent across the fleet, built
// from data the dashboard already has. Pure, unit-tested.
//
// Every item: { key, kind, level, deviceId, name, days | hours, path, sort }.
// level: critical (act today) · high · medium. Within a level the longest overdue comes first.

export const LEVELS = ['critical', 'high', 'medium'];

// A vehicle that has not reported for this long is silent; three times as long is serious.
export const SILENT_HOURS = 24;

const HOUR = 3600000;
const LIVE_STATUS = new Set(['online']);
const OPEN_MAINTENANCE = { overdue: 'high', due: 'medium' };
const INCIDENT_LEVEL = { severe: 'high', moderate: 'medium', minor: 'medium' };

const fromExpiries = (rows) =>
  rows
    .filter((row) => row.status === 'expired' || row.status === 'expiring')
    .map((row) => ({
      key: `expiry-${row.id}`,
      kind: 'expiry',
      level: row.status === 'expired' ? 'critical' : 'medium',
      deviceId: row.entity === 'vehicle' ? row.entityId : null,
      name: row.plateNumber || row.name,
      labelKey: row.labelKey,
      days: row.days,
      path:
        row.entity === 'vehicle'
          ? `/fleet/vehicle/${row.entityId}?tab=documents`
          : '/fleet/expiries',
      sort: -row.days,
    }));

const fromMaintenance = (rows) =>
  rows
    .filter((row) => OPEN_MAINTENANCE[row.maintenanceStatus])
    .map((row) => ({
      key: `maintenance-${row.deviceId}-${row.maintenance.id}`,
      kind: 'maintenance',
      level: OPEN_MAINTENANCE[row.maintenanceStatus],
      deviceId: row.deviceId,
      label: row.maintenance.name,
      overdue: row.maintenanceStatus === 'overdue',
      path: `/fleet/vehicle/${row.deviceId}?tab=maintenance`,
      sort: row.maintenanceStatus === 'overdue' ? 1 : 0,
    }));

const fromIncidents = (rows, now) =>
  rows
    .filter((row) => row.status !== 'closed')
    .map((row) => {
      const days = Math.max(0, Math.floor((now - Date.parse(row.occurred_at)) / (24 * HOUR)));
      return {
        key: `incident-${row.id}`,
        kind: 'incident',
        level: INCIDENT_LEVEL[row.severity] ?? 'medium',
        deviceId: row.deviceId,
        incidentType: row.type,
        status: row.status,
        days: -days,
        path: `/fleet/incident/${row.id}`,
        sort: days,
      };
    });

const fromLive = (rows, now) =>
  rows
    .filter((row) => !LIVE_STATUS.has(row.status) && row.lastUpdate)
    .map((row) => ({ row, hours: Math.floor((now - row.lastUpdate) / HOUR) }))
    .filter(({ hours }) => hours >= SILENT_HOURS)
    .map(({ row, hours }) => ({
      key: `silent-${row.deviceId}`,
      kind: 'silent',
      level: hours >= SILENT_HOURS * 3 ? 'high' : 'medium',
      deviceId: row.deviceId,
      hours,
      path: `/reports/device-health?deviceId=${row.deviceId}&period=today`,
      sort: hours / 24,
    }));

const fromViolations = (rows, now) =>
  rows
    .map((row) => ({ row, urgency: violationUrgency(row, new Date(now)) }))
    .filter(({ urgency }) => urgency.level === 'overdue' || urgency.level === 'soon')
    .map(({ row, urgency }) => ({
      key: `violation-${row.id}`,
      kind: 'violation',
      level: urgency.level === 'overdue' ? 'critical' : 'high',
      deviceId: row.vehicles?.traccar_device_id ?? null,
      name: row.drivers?.full_name || row.vehicles?.plate_number || null,
      days: urgency.days,
      path: '/fleet/safety?view=violations',
      sort: -urgency.days,
    }));

// sources: { expiries, maintenance, incidents, live, violations } — any may be missing.
export const attentionItems = (sources, now = Date.now()) => {
  const items = [
    ...fromExpiries(sources.expiries ?? []),
    ...fromMaintenance(sources.maintenance ?? []),
    ...fromIncidents(sources.incidents ?? [], now),
    ...fromLive(sources.live ?? [], now),
    ...fromViolations(sources.violations ?? [], now),
  ];
  return items.sort(
    (a, b) =>
      LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) ||
      b.sort - a.sort ||
      a.key.localeCompare(b.key),
  );
};

export const attentionCounts = (items) =>
  Object.fromEntries(LEVELS.map((level) => [level, items.filter((i) => i.level === level).length]));
