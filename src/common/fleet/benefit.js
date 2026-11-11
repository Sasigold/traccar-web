// ISR-05: the monthly taxable benefit of a company car ("שווי שימוש"), for payroll.
// 2.48% of the list price, with the list price capped (2026: 596,860 ₪); electric and plug-in
// hybrid cars get a monthly reduction. The figures are the 2026 values and must be checked with
// an accountant every year (they change in January); they are settings, not code, in the app.
export const BENEFIT_2026 = {
  rate: 0.0248,
  priceCap: 596860,
  // Monthly reductions (₪) by propulsion, 2026 values to confirm.
  reductions: { electric: 1350, plugin: 1130, hybrid: 560 },
};

// The app's fuel types: electric and hybrid get their reductions (plug-in hybrids are not told
// apart from hybrids in the vehicle card yet).
export const propulsionOf = (fuelType) =>
  fuelType === 'electric' ? 'electric' : fuelType === 'hybrid' ? 'hybrid' : 'fuel';

export const monthlyBenefit = (listPrice, propulsion = 'fuel', rules = BENEFIT_2026) => {
  const price = Number(listPrice);
  if (!(price > 0)) return null;
  const base = Math.min(price, rules.priceCap) * rules.rate;
  const reduction = rules.reductions[propulsion] || 0;
  return Math.max(0, Math.round(base - reduction));
};

// Pool cars: the benefit is charged for the days a driver took the car home.
export const poolBenefit = (monthly, nightsHome, daysInMonth) =>
  monthly == null || !daysInMonth ? null : Math.round((monthly * nightsHome) / daysInMonth);

// ISR-05: the pool cars' night log for a month: every night a booking held the car at 02:00
// (the car slept with the driver), from approved or returned bookings. Returns the nights one by
// one ({ date 'YYYY-MM-DD', personId, vehicleId }) and per person and vehicle ({ personId,
// vehicleId, nights }). `month` is any moment in the month; local time.
export const poolNights = (bookings, month) => {
  const first = new Date(new Date(month).getFullYear(), new Date(month).getMonth(), 1);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const log = [];
  (bookings || [])
    .filter((booking) => ['approved', 'returned'].includes(booking.status))
    .forEach((booking) => {
      const start = Date.parse(booking.starts_at);
      const end = Date.parse(booking.ends_at);
      for (let day = 1; day <= days; day += 1) {
        const night = new Date(first.getFullYear(), first.getMonth(), day, 2).getTime();
        if (night >= start && night < end) {
          const date = new Date(first.getFullYear(), first.getMonth(), day);
          const pad = (n) => String(n).padStart(2, '0');
          log.push({
            date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(day)}`,
            personId: booking.requested_by,
            vehicleId: booking.vehicle_id,
          });
        }
      }
    });
  const totals = new Map();
  log.forEach((night) => {
    const key = `${night.personId}|${night.vehicleId}`;
    const row = totals.get(key) || {
      personId: night.personId,
      vehicleId: night.vehicleId,
      nights: 0,
    };
    row.nights += 1;
    totals.set(key, row);
  });
  return {
    days,
    log: log.sort((a, b) => a.date.localeCompare(b.date)),
    totals: [...totals.values()],
  };
};
