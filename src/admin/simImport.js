// BIZ-05: the carrier's SIM list (CSV or Excel) -> sim_cards rows. Columns are found by their
// header (Hebrew or English); a row without a valid ICCID is skipped and counted. Pure.

const HINTS = {
  iccid: ['iccid', 'סים', 'מספר סים', 'sim'],
  msisdn: ['msisdn', 'טלפון', 'מספר טלפון', 'phone', 'number', 'מנוי'],
  carrier: ['carrier', 'ספק', 'מפעיל', 'operator', 'provider'],
};

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const simColumns = (headers) => {
  const names = headers.map(normalize);
  return Object.fromEntries(
    Object.entries(HINTS).map(([field, hints]) => [
      field,
      names.findIndex((name) => hints.some((hint) => name.includes(hint))),
    ]),
  );
};

export const cleanIccid = (value) =>
  String(value ?? '')
    .replace(/\s|-/g, '')
    .toUpperCase();

export const parseSims = (rows) => {
  const [headers = [], ...lines] = rows;
  const columns = simColumns(headers);
  const sims = [];
  let skipped = 0;
  const seen = new Set();
  lines.forEach((line) => {
    const iccid = cleanIccid(line[columns.iccid]);
    if (!/^[0-9]{18,22}F?$/.test(iccid) || seen.has(iccid)) {
      if (line.some((cell) => String(cell ?? '').trim())) skipped += 1;
      return;
    }
    seen.add(iccid);
    const msisdn = String(line[columns.msisdn] ?? '').replace(/[^\d+]/g, '');
    sims.push({
      iccid,
      msisdn: /^\+?[0-9]{7,15}$/.test(msisdn) ? msisdn : null,
      carrier: columns.carrier >= 0 ? String(line[columns.carrier] ?? '').trim() || null : null,
    });
  });
  return { sims, skipped };
};
