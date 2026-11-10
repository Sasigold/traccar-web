// Costs per vehicle (pure, unit-tested).

// vehicle_monthly_costs rows -> one line per vehicle with fuel / maintenance / other / total,
// most expensive first, plus the fleet totals.
export const pivotCosts = (rows) => {
  const byVehicle = new Map();
  const totals = { fuel: 0, maintenance: 0, other: 0, total: 0 };
  rows.forEach((row) => {
    const amount = Number(row.amount) || 0;
    const bucket =
      row.category === 'fuel' || row.category === 'maintenance' ? row.category : 'other';
    const line = byVehicle.get(row.vehicle_id) || {
      vehicleId: row.vehicle_id,
      fuel: 0,
      maintenance: 0,
      other: 0,
      total: 0,
    };
    line[bucket] += amount;
    line.total += amount;
    totals[bucket] += amount;
    totals.total += amount;
    byVehicle.set(row.vehicle_id, line);
  });
  const round = (value) => Math.round(value * 100) / 100;
  const lines = [...byVehicle.values()]
    .map((line) => ({
      ...line,
      fuel: round(line.fuel),
      maintenance: round(line.maintenance),
      other: round(line.other),
      total: round(line.total),
    }))
    .sort((a, b) => b.total - a.total);
  return {
    lines,
    totals: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value)])),
  };
};

// First day of the month `months` ago, as YYYY-MM-DD (the view groups by month).
export const periodStart = (months, now = new Date()) => {
  const date = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
};

// ADM-18: shekels per kilometre for each line, from the distance each vehicle drove in the
// period (meters by vehicle id). No distance, no figure. Pure.
export const withCostPerKm = (lines, metersByVehicle) =>
  lines.map((line) => {
    const km = (metersByVehicle?.[line.vehicleId] || 0) / 1000;
    return {
      ...line,
      km: km > 0 ? Math.round(km) : null,
      perKm: km >= 1 && line.total > 0 ? Math.round((line.total / km) * 100) / 100 : null,
    };
  });
