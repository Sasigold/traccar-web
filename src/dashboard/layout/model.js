// Geometry of the dashboard grid. Pure: no React, no MUI.
//
// A dashboard is a list of rows. Each row has a height in units and 1..6 cells
// whose widths always add up to 12 columns. Each cell holds 1..3 widgets stacked
// on top of each other whose heights always add up to the row height. Because
// every row is always exactly full, the grid has no gaps by construction.

export const COLS = 12;
export const UNIT = 40; // px per height unit
export const GAP = 16; // px between cells and rows (desktop)
export const GAP_COMPACT = 12; // px below the md breakpoint
export const ROW_MIN = 2;
export const ROW_MAX = 16;
export const MAX_CELLS = 6;
export const MAX_STACK = 3;
export const MAX_WIDGETS = 40;
export const MAX_DASHBOARDS = 8;

export const WIDTH_PRESETS = [3, 4, 6, 8, 9, 12];
export const HEIGHT_PRESETS = { s: 3, m: 5, l: 7, xl: 10 };

// Height in px of `units` units, gaps included, so stacked edges line up across cells.
export const unitsToPx = (units, gap = GAP) => units * UNIT + (units - 1) * gap;

let counter = 0;
export const uid = (prefix = '') => {
  counter = (counter + 1) % 1296;
  return `${prefix}${Date.now().toString(36).slice(-4)}${counter.toString(36).padStart(2, '0')}${Math.floor(
    Math.random() * 36,
  ).toString(36)}`;
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const toInt = (value, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
};

export const cloneRows = (rows) =>
  rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell) => ({ ...cell, items: cell.items.map((item) => ({ ...item })) })),
  }));

export const sum = (values) => values.reduce((total, value) => total + value, 0);

export const locate = (rows, id) => {
  for (let r = 0; r < rows.length; r += 1) {
    const { cells } = rows[r];
    for (let c = 0; c < cells.length; c += 1) {
      const i = cells[c].items.findIndex((item) => item.id === id);
      if (i >= 0) {
        return { r, c, i, row: rows[r], cell: cells[c], item: cells[c].items[i] };
      }
    }
  }
  return null;
};

export const widgetIds = (rows) =>
  rows.flatMap((row) => row.cells.flatMap((cell) => cell.items.map((item) => item.id)));

// minOf(id) → { w, h } minimum size of one widget.
export const cellMinW = (cell, minOf) => Math.max(1, ...cell.items.map((item) => minOf(item.id).w));
export const cellMinH = (cell, minOf) => sum(cell.items.map((item) => minOf(item.id).h));
export const rowMinH = (row, minOf) =>
  Math.max(ROW_MIN, ...row.cells.map((cell) => cellMinH(cell, minOf)));

// Splits `total` into n integers as evenly as possible, the remainder going to the first ones.
export const distributeEven = (total, n) => {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, index) => base + (index < total - base * n ? 1 : 0));
};

// Integer apportionment: integers >= mins that add up to `total`, proportional to how
// much each weight exceeds its minimum (largest remainder). Weights that already add
// up to `total` and respect the minimums come back unchanged. Null when the minimums
// alone exceed the total.
export const scaleTo = (weights, total, mins) => {
  const n = weights.length;
  const minSum = sum(mins);
  if (n === 0 || minSum > total) {
    return null;
  }
  const free = total - minSum;
  let extra = weights.map((weight, index) => Math.max(0, weight - mins[index]));
  if (sum(extra) === 0) {
    extra = extra.map(() => 1);
  }
  const extraSum = sum(extra);
  const ideal = extra.map((value) => (free * value) / extraSum);
  const base = ideal.map(Math.floor);
  let rest = free - sum(base);
  const order = ideal
    .map((value, index) => ({ index, fraction: value - base[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let k = 0; rest > 0; k = (k + 1) % n) {
    base[order[k].index] += 1;
    rest -= 1;
  }
  return base.map((value, index) => value + mins[index]);
};

// Takes up to `amount` from `values` (respecting mins), visiting indexes in `order`;
// each index gives as much as it can before the next one is asked. Returns what was taken.
export const takeInOrder = (values, mins, order, amount) => {
  let rest = amount;
  order.forEach((index) => {
    if (rest > 0) {
      const give = Math.min(rest, Math.max(0, values[index] - mins[index]));
      values[index] -= give;
      rest -= give;
    }
  });
  return amount - rest;
};

// Takes `amount` one unit at a time from whichever value has the most room above its
// minimum (widest first); used when no single neighbour is the natural donor.
export const takeWidestFirst = (values, mins, amount, exclude = -1) => {
  let rest = amount;
  while (rest > 0) {
    let best = -1;
    values.forEach((value, index) => {
      if (index !== exclude && value - mins[index] > 0) {
        if (best < 0 || value > values[best]) {
          best = index;
        }
      }
    });
    if (best < 0) {
      break;
    }
    values[best] -= 1;
    rest -= 1;
  }
  return amount - rest;
};
