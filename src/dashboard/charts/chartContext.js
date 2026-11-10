// REP-18: what a figure is compared with and measured in, said in words.

// "1.11–7.11": the earlier period a change is measured against (day.month, no year).
export const compareRangeText = (previous) => {
  if (!previous?.from || !previous?.to) return '';
  const day = (date) => `${date.date()}.${date.month() + 1}`;
  const from = day(previous.from);
  const to = day(previous.to);
  return from === to ? from : `${from}–${to}`;
};

// A number typed as a target: a positive figure or nothing.
export const parseTarget = (text) => {
  if (text === '' || text == null) return undefined;
  const value = Number(String(text).replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

// Where a value stands against its target, as a share (1 = on target).
export const againstTarget = (value, target) =>
  target && value != null && Number.isFinite(value) ? value / target : null;
