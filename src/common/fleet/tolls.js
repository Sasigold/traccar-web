// ISR-06: toll and parking charges (Road 6, the Carmel tunnels, the fast lane, Pango, Cellopark)
// matched to the trip and the driver. There is no public API for fleets, so charges come from the
// monthly statements as files. Each row: { time, plate, amount, operator, place }.

const digits = (value) => String(value ?? '').replace(/\D/g, '');

// The trip a charge belongs to: same vehicle (by plate), and the charge time within the trip
// (with a margin, since statements round times). trips: [{ deviceId, startTime, endTime,
// driverUniqueId }]; vehicles: [{ deviceId, plate }].
export const matchCharges = (charges, trips, vehicles, marginMs = 10 * 60000) => {
  const byPlate = new Map(vehicles.map((vehicle) => [digits(vehicle.plate), vehicle.deviceId]));
  return charges.map((charge) => {
    const deviceId = byPlate.get(digits(charge.plate)) ?? null;
    const at = Date.parse(charge.time);
    const trip =
      deviceId == null
        ? null
        : trips.find(
            (item) =>
              item.deviceId === deviceId &&
              Date.parse(item.startTime) - marginMs <= at &&
              at <= Date.parse(item.endTime) + marginMs,
          ) || null;
    return {
      ...charge,
      deviceId,
      trip,
      driver: trip?.driverUniqueId || null,
      status: deviceId == null ? 'unknownPlate' : trip ? 'matched' : 'noTrip',
    };
  });
};

// Totals per driver (and "unknown") for the month, for cost centers and payroll.
export const chargesByDriver = (matched) => {
  const totals = new Map();
  matched.forEach((row) => {
    const key = row.driver || 'unknown';
    totals.set(key, (totals.get(key) || 0) + (Number(row.amount) || 0));
  });
  return [...totals.entries()].map(([driver, amount]) => ({
    driver,
    amount: Math.round(amount * 100) / 100,
  }));
};

// The columns of a statement, by their usual Hebrew and English names.
export const TOLL_HINTS = {
  time: ['תאריך ושעה', 'מועד', 'תאריך', 'date', 'time'],
  plate: ['מספר רכב', 'מספר רישוי', 'רכב', 'plate', 'vehicle'],
  amount: ['סכום', 'מחיר', 'לתשלום', 'amount', 'total'],
  operator: ['מפעיל', 'כביש', 'חניון', 'operator', 'road'],
  place: ['קטע', 'מקום', 'כתובת', 'segment', 'location'],
};

// Statement rows to charges, with the columns found by guessColumns.
export const toCharges = (rows, mapping, parseDate, parseNumber) =>
  rows
    .map((row) => ({
      time: parseDate(row[mapping.time]),
      plate: row[mapping.plate],
      amount: parseNumber(row[mapping.amount]),
      operator: mapping.operator != null ? row[mapping.operator] : null,
      place: mapping.place != null ? row[mapping.place] : null,
    }))
    .filter((charge) => charge.time && charge.plate && Number.isFinite(charge.amount));
