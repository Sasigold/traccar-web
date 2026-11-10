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
