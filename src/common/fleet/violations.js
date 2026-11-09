// Traffic and parking tickets on company vehicles (ISR-02). Pure helpers, unit-tested.

// The usual time to tell the authority who drove, from the day the notice arrived.
export const TRANSFER_DAYS = 90;

// A ticket that is not assigned to the driver in time is charged to the company, usually at
// four times the fine (Traffic Ordinance; 1,500 ₪ becomes 6,000 ₪).
export const COMPANY_PENALTY_FACTOR = 4;

const DAY = 24 * 60 * 60 * 1000;

const isoDate = (date) => new Date(date).toISOString().slice(0, 10);

export const transferDeadline = (receivedAt) =>
  /^\d{4}-\d{2}-\d{2}$/.test(receivedAt || '')
    ? isoDate(Date.parse(`${receivedAt}T00:00:00Z`) + TRANSFER_DAYS * DAY)
    : '';

const SETTLED = new Set(['transferred', 'paid', 'closed']);

// How urgent a ticket is: days to its deadline and a level for the list.
// done: transferred, paid or closed · overdue · soon (14 days or less) · ok · none (no deadline).
export const violationUrgency = (violation, today = new Date()) => {
  if (SETTLED.has(violation.status)) {
    return { level: 'done', days: null };
  }
  if (!violation.due_at) {
    return { level: 'none', days: null };
  }
  const days = Math.round(
    (Date.parse(`${violation.due_at}T00:00:00Z`) - Date.parse(`${isoDate(today)}T00:00:00Z`)) / DAY,
  );
  return { level: days < 0 ? 'overdue' : days <= 14 ? 'soon' : 'ok', days };
};

export const companyPenalty = (fine) =>
  Number(fine) > 0 ? Number(fine) * COMPANY_PENALTY_FACTOR : null;

// Tickets per driver: count, still open, fines, points, and fines still to charge.
export const violationsByDriver = (violations) => {
  const groups = new Map();
  violations.forEach((violation) => {
    const key = violation.driver_id || 'unknown';
    const group = groups.get(key) || {
      driverId: violation.driver_id || null,
      name: violation.drivers?.full_name || null,
      traccarDriverId: violation.drivers?.traccar_driver_id ?? null,
      count: 0,
      open: 0,
      fines: 0,
      points: 0,
      toCharge: 0,
    };
    group.count += 1;
    if (!SETTLED.has(violation.status) && violation.status !== 'appealed') {
      group.open += 1;
    }
    group.fines += Number(violation.fine_amount) || 0;
    group.points += Number(violation.points) || 0;
    if (violation.charge_driver && !violation.charged_at) {
      group.toCharge += Number(violation.fine_amount) || 0;
    }
    groups.set(key, group);
  });
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || b.fines - a.fines || (a.name || '').localeCompare(b.name || ''),
  );
};

// The notice to the issuing authority naming the driver ("הסבת דוח"), as plain paragraphs the
// letter window lays out. Blank fields become a line to fill in by hand.
export const transferLetter = ({ violation, driver, plate, organization, today }, t, format) => {
  const blank = '________';
  const value = (text) => (text == null || text === '' ? blank : String(text));
  const occurred = violation.occurred_at ? new Date(violation.occurred_at) : null;
  return {
    date: format(today || new Date(), 'date'),
    sender: value(organization),
    to: `${t('fleetLetterTo')} ${value(violation.authority)}`,
    subject: `${t('fleetLetterSubject')} ${value(violation.reference_no)}`,
    body: [
      t('fleetLetterBody')
        .replace('{0}', occurred ? format(occurred, 'date') : blank)
        .replace('{1}', occurred ? format(occurred, 'clock') : blank)
        .replace('{2}', value(plate)),
      `${t('fleetLetterDriver')}: ${value(driver?.full_name)}`,
      `${t('fleetLetterNationalId')}: ${value(driver?.national_id)}`,
      `${t('fleetLetterLicense')}: ${value(driver?.license_number)}`,
      t('fleetLetterRequest'),
    ],
    declaration: t('fleetLetterDeclaration').replace('{0}', value(driver?.full_name)),
    signatures: [t('fleetLetterSignCompany'), t('fleetLetterSignDriver')],
  };
};
