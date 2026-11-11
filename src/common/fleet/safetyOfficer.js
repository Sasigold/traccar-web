// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
// The safety officer's work plan (ISR-04, Transport Regulations 585): which meetings, checks,
// investigations and tachograph downloads are due, from the records already kept. Pure functions,
// unit-tested. The frequencies are defaults the organization can change; check them against the
// regulations' text.

export const DEFAULT_OFFICER_RULES = {
  meetingMonths: 3, // a documented meeting with each professional driver
  licenseCheckMonthsProfessional: 6, // licence and traffic record check (585א)
  licenseCheckMonthsOther: 36,
  investigationDays: 14, // an accident investigation is due this long after the accident
  tachographDays: 28, // between downloads
  tachographKeepDays: 180, // keep the files at least this long
  soonDays: 14, // "due soon" from this many days before
};

const DAY = 24 * 60 * 60 * 1000;
const isoDay = (time) => new Date(time).toISOString().slice(0, 10);
const dayStart = (value) => Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);

export const addMonths = (value, months) => {
  const date = new Date(dayStart(value));
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return isoDay(date);
};

const addDays = (value, days) => isoDay(dayStart(value) + days * DAY);

const latest = (rows, key) =>
  rows.reduce((best, row) => (!best || String(row[key]) > String(best[key]) ? row : best), null);

export const licenseCheckMonths = (driver, rules) =>
  driver.is_professional ? rules.licenseCheckMonthsProfessional : rules.licenseCheckMonthsOther;

// overdue / soon / ok, and the days left (negative when late).
export const taskStatus = (dueAt, today, rules = DEFAULT_OFFICER_RULES) => {
  const days = Math.round((dayStart(dueAt) - dayStart(isoDay(today))) / DAY);
  return { days, status: days < 0 ? 'overdue' : days <= rules.soonDays ? 'soon' : 'ok' };
};

// Every duty with its due date, most urgent first.
export const safetyTasks = (
  {
    drivers = [],
    reviews = [],
    checks = [],
    incidents = [],
    investigations = [],
    tachographs = [],
  },
  rulesOverride = {},
  today = new Date(),
) => {
  const rules = { ...DEFAULT_OFFICER_RULES, ...rulesOverride };
  const tasks = [];
  const active = drivers.filter((driver) => driver.status !== 'inactive');

  active.forEach((driver) => {
    if (driver.is_professional) {
      const meeting = latest(
        reviews.filter((row) => row.driver_id === driver.id && row.kind === 'periodic'),
        'held_at',
      );
      tasks.push({
        kind: 'meeting',
        driverId: driver.id,
        name: driver.full_name,
        lastAt: meeting?.held_at || null,
        dueAt: meeting ? addMonths(meeting.held_at, rules.meetingMonths) : isoDay(today),
        unsigned: Boolean(meeting && !meeting.driver_signed_at),
      });
    }
    const check = latest(
      checks.filter((row) => row.driver_id === driver.id),
      'checked_at',
    );
    tasks.push({
      kind: 'licenseCheck',
      driverId: driver.id,
      name: driver.full_name,
      lastAt: check?.checked_at || null,
      dueAt: check
        ? check.next_check_at || addMonths(check.checked_at, licenseCheckMonths(driver, rules))
        : isoDay(today),
    });
  });

  // Accidents without an investigation.
  const investigated = new Set(investigations.map((row) => row.incident_id).filter(Boolean));
  incidents
    .filter((incident) => incident.type === 'accident' && !investigated.has(incident.id))
    .forEach((incident) => {
      tasks.push({
        kind: 'investigation',
        incidentId: incident.id,
        driverId: incident.driver_id || null,
        name: incident.number ? String(incident.number) : null,
        lastAt: isoDay(incident.occurred_at),
        dueAt: addDays(incident.occurred_at, rules.investigationDays),
      });
    });

  // Tachographs: every vehicle or card downloaded before is due again after the interval.
  const groups = new Map();
  tachographs.forEach((row) => {
    const key = row.kind === 'card' ? `card:${row.driver_id}` : `vehicle:${row.vehicle_id}`;
    const current = groups.get(key);
    if (!current || String(row.downloaded_at) > String(current.downloaded_at)) {
      groups.set(key, row);
    }
  });
  groups.forEach((row) => {
    tasks.push({
      kind: 'tachograph',
      tachographKind: row.kind,
      vehicleId: row.kind === 'card' ? null : row.vehicle_id,
      driverId: row.kind === 'card' ? row.driver_id : null,
      lastAt: row.downloaded_at,
      dueAt: addDays(row.downloaded_at, rules.tachographDays),
    });
  });

  return tasks
    .map((task) => ({ ...task, ...taskStatus(task.dueAt, today, rules) }))
    .sort((a, b) => a.days - b.days);
};

// The quarter a date falls in, as [from, to] days and a label ("2026 Q4").
export const quarterOf = (value = new Date()) => {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const first = Math.floor(date.getUTCMonth() / 3) * 3;
  return {
    from: isoDay(Date.UTC(year, first, 1)),
    to: isoDay(Date.UTC(year, first + 3, 0)),
    year,
    quarter: first / 3 + 1,
  };
};

// What the quarter's report to the owner says: duties done and open, by kind.
export const quarterSummary = (records, tasks, quarter) => {
  const within = (value) =>
    value && value.slice(0, 10) >= quarter.from && value.slice(0, 10) <= quarter.to;
  const count = (rows, key, test = () => true) =>
    rows.filter((row) => within(row[key]) && test(row)).length;
  return {
    meetings: count(records.reviews || [], 'held_at', (row) => row.kind === 'periodic'),
    meetingsSigned: count(
      records.reviews || [],
      'held_at',
      (row) => row.kind === 'periodic' && row.driver_signed_at,
    ),
    investigations: count(records.reviews || [], 'held_at', (row) => row.kind === 'investigation'),
    licenseChecks: count(records.checks || [], 'checked_at'),
    trainings: count(records.trainings || [], 'held_at'),
    accidents: count(records.incidents || [], 'occurred_at', (row) => row.type === 'accident'),
    violations: count(records.violations || [], 'occurred_at'),
    tachographs: count(records.tachographs || [], 'downloaded_at'),
    overdue: tasks.filter((task) => task.status === 'overdue').length,
    soon: tasks.filter((task) => task.status === 'soon').length,
  };
};

// Work orders go to garages licensed by the Ministry of Transport. Null when there is nothing to
// say; otherwise 'unlicensed', 'unknown' (not recorded) or 'expired'.
export const garageLicenseIssue = (vendor, today = new Date()) => {
  if (!vendor || vendor.type !== 'garage') {
    return null;
  }
  if (vendor.licensed === false) {
    return 'unlicensed';
  }
  if (vendor.licensed == null) {
    return 'unknown';
  }
  if (vendor.license_valid_until && vendor.license_valid_until < isoDay(today)) {
    return 'expired';
  }
  return null;
};
