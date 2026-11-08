import {
  COLS,
  MAX_CELLS,
  MAX_STACK,
  ROW_MAX,
  ROW_MIN,
  cellMinH,
  cellMinW,
  clamp,
  rowMinH,
  scaleTo,
  sum,
  toInt,
  uid,
} from './model';

// Repairs one row in place: widths add up to 12 and respect minimums, the height
// fits every stack, and every stack adds up to the height.
export const fitRow = (row, minOf) => {
  const mins = row.cells.map((cell) => cellMinW(cell, minOf));
  const widths = row.cells.map((cell) => cell.w);
  const okWidths = sum(widths) === COLS && widths.every((width, index) => width >= mins[index]);
  if (!okWidths) {
    const scaled = scaleTo(widths, COLS, mins) ?? mins;
    row.cells.forEach((cell, index) => {
      cell.w = scaled[index];
    });
  }
  row.h = clamp(Math.max(row.h, rowMinH(row, minOf)), ROW_MIN, ROW_MAX);
  row.cells.forEach((cell) => {
    const heights = cell.items.map((item) => item.h);
    const itemMins = cell.items.map((item) => minOf(item.id).h);
    if (sum(heights) !== row.h || heights.some((height, index) => height < itemMins[index])) {
      const scaled = scaleTo(heights, row.h, itemMins) ?? itemMins;
      cell.items.forEach((item, index) => {
        item.h = scaled[index];
      });
    }
  });
  return row;
};

// Splits cells that cannot live in one row (too many, or their minimum widths add up
// to more than 12) into consecutive rows, in order. Each piece is then fitted.
const splitRow = (row, minOf) => {
  const lines = [];
  let line = [];
  let used = 0;
  row.cells.forEach((cell) => {
    const min = cellMinW(cell, minOf);
    if (line.length && (line.length >= MAX_CELLS || used + min > COLS)) {
      lines.push(line);
      line = [];
      used = 0;
    }
    line.push(cell);
    used += min;
  });
  if (line.length) {
    lines.push(line);
  }
  return lines.map((cells, index) =>
    fitRow({ id: index === 0 ? row.id : uid('r'), h: row.h, cells }, minOf),
  );
};

// A stack whose minimum heights exceed the tallest row is broken into separate cells.
const splitStack = (cell, minOf) => {
  const cells = [cell];
  while (
    cell.items.length > 1 &&
    (cell.items.length > MAX_STACK || cellMinH(cell, minOf) > ROW_MAX)
  ) {
    const item = cell.items.pop();
    cells.splice(1, 0, { id: uid('c'), w: 1, items: [{ ...item, h: minOf(item.id).h }] });
  }
  return cells;
};

// Validates and repairs a whole layout. Unknown or duplicate widgets are dropped,
// numbers are coerced and clamped, empty cells and rows disappear, and every row
// ends up exactly full. Never throws on garbage input.
export const normalizeRows = (input, minOf, exists = () => true) => {
  const seen = new Set();
  const rows = [];
  (Array.isArray(input) ? input : []).forEach((rawRow) => {
    if (!rawRow || !Array.isArray(rawRow.cells)) {
      return;
    }
    const cells = [];
    rawRow.cells.forEach((rawCell) => {
      if (!rawCell || !Array.isArray(rawCell.items)) {
        return;
      }
      const items = rawCell.items
        .filter((item) => item && typeof item.id === 'string')
        .filter((item) => {
          if (seen.has(item.id) || !exists(item.id)) {
            return false;
          }
          seen.add(item.id);
          return true;
        })
        .map((item) => ({ id: item.id, h: Math.max(1, toInt(item.h, minOf(item.id).h)) }));
      if (items.length) {
        const cell = {
          id: typeof rawCell.id === 'string' ? rawCell.id : uid('c'),
          w: clamp(toInt(rawCell.w, 1), 1, COLS),
          items,
        };
        cells.push(...splitStack(cell, minOf));
      }
    });
    if (cells.length) {
      const row = {
        id: typeof rawRow.id === 'string' ? rawRow.id : uid('r'),
        h: clamp(toInt(rawRow.h, ROW_MIN), ROW_MIN, ROW_MAX),
        cells,
      };
      rows.push(...splitRow(row, minOf));
    }
  });
  const rowIds = new Set();
  const cellIds = new Set();
  rows.forEach((row) => {
    if (rowIds.has(row.id)) {
      row.id = uid('r');
    }
    rowIds.add(row.id);
    row.cells.forEach((cell) => {
      if (cellIds.has(cell.id)) {
        cell.id = uid('c');
      }
      cellIds.add(cell.id);
    });
  });
  return rows;
};

// True when every invariant holds (used by tests and development assertions).
export const checkRows = (rows, minOf) =>
  rows.every((row) => {
    const widths = row.cells.map((cell) => cell.w);
    return (
      row.cells.length >= 1 &&
      row.cells.length <= MAX_CELLS &&
      row.h >= ROW_MIN &&
      row.h <= ROW_MAX &&
      sum(widths) === COLS &&
      row.cells.every(
        (cell) =>
          cell.w >= cellMinW(cell, minOf) &&
          cell.items.length >= 1 &&
          cell.items.length <= MAX_STACK &&
          sum(cell.items.map((item) => item.h)) === row.h &&
          cell.items.every((item) => item.h >= minOf(item.id).h),
      )
    );
  });
