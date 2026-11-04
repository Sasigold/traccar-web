// Billing math for the super admin area. Pure functions so the numbers on
// screen, in the generated bills and in the tests are always the same.
// Prices are in ILS before VAT; the database recomputes the stored totals.

export const DEFAULT_VAT_RATE = 18;

export const cycles = ['monthly', 'quarterly', 'yearly'];

export const cycleMonths = { monthly: 1, quarterly: 3, yearly: 12 };

export const paymentMethods = ['transfer', 'card', 'standingOrder', 'check', 'cash'];

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const pick = (override, fallback) =>
  override === null || override === undefined || override === ''
    ? Number(fallback) || 0
    : Number(override);

// The prices that apply to a customer: subscription overrides, else the plan.
export const effectiveTerms = (subscription, plan) => ({
  perDevice: pick(subscription?.price_per_device, plan?.price_per_device),
  base: pick(subscription?.base_price, plan?.base_price),
  discount: Number(subscription?.discount_percent) || 0,
  cycle: subscription?.cycle || plan?.cycle || 'monthly',
});

// Recurring revenue per month, before VAT.
export const monthlyAmount = (subscription, plan, billableDevices) => {
  if (!subscription || subscription.status !== 'active') {
    return 0;
  }
  const terms = effectiveTerms(subscription, plan);
  const gross = terms.base + terms.perDevice * (billableDevices || 0);
  return round2(gross * (1 - terms.discount / 100));
};

const pad = (value) => String(value).padStart(2, '0');

export const toIsoDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseIsoDate = (text) => {
  const [year, month, day] = String(text).split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (text, days) => {
  const date = parseIsoDate(text);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

// The billing period that contains `date`, aligned to calendar months:
// monthly = the month, quarterly = the calendar quarter, yearly = the year.
export const periodFor = (date, cycle = 'monthly') => {
  const months = cycleMonths[cycle] || 1;
  const year = date.getFullYear();
  const startMonth = Math.floor(date.getMonth() / months) * months;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + months, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
};

// Draft bill for one customer and period: a line for the base fee, one for the
// devices and a discount line. `labels` keeps this module free of i18n.
export const buildInvoiceDraft = ({
  customerId,
  subscription,
  plan,
  billableDevices,
  period,
  issueDate,
  vatRate = DEFAULT_VAT_RATE,
  labels,
}) => {
  const terms = effectiveTerms(subscription, plan);
  const months = cycleMonths[terms.cycle] || 1;
  const lines = [];
  if (terms.base > 0) {
    lines.push({ description: labels.base, quantity: months, unit_price: terms.base });
  }
  if (billableDevices > 0 && terms.perDevice > 0) {
    lines.push({
      description: labels.devices,
      quantity: billableDevices * months,
      unit_price: terms.perDevice,
    });
  }
  const gross = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  if (terms.discount > 0 && gross > 0) {
    lines.push({
      description: labels.discount.replace('{0}', String(terms.discount)),
      quantity: 1,
      unit_price: -round2((gross * terms.discount) / 100),
    });
  }
  const termsDays = Number(subscription?.payment_terms_days ?? 30);
  return {
    invoice: {
      customer_id: customerId,
      issue_date: issueDate,
      due_date: addDays(issueDate, termsDays),
      period_start: period.start,
      period_end: period.end,
      vat_rate: vatRate,
      status: 'draft',
      payment_method: subscription?.payment_method || null,
    },
    lines: lines.map((line, index) => ({ ...line, sort_order: index })),
  };
};

export const lineAmount = (line) =>
  round2((Number(line.quantity) || 0) * (Number(line.unit_price) || 0));

export const invoiceTotals = (lines, vatRate = DEFAULT_VAT_RATE) => {
  const subtotal = round2(lines.reduce((sum, line) => sum + lineAmount(line), 0));
  const vat = round2((subtotal * (Number(vatRate) || 0)) / 100);
  return { subtotal, vat, total: round2(subtotal + vat) };
};

// What a bill means right now: draft, issued (open), overdue, paid or cancelled.
export const invoiceState = (invoice, today = toIsoDate(new Date())) => {
  if (invoice.status === 'issued' && invoice.due_date && invoice.due_date < today) {
    return 'overdue';
  }
  return invoice.status;
};

export const formatMoney = (value, language = 'he', currency = 'ILS') =>
  new Intl.NumberFormat(language === 'he' ? 'he-IL' : 'en-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
