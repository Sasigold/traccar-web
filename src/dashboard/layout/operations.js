import {
  COLS,
  MAX_CELLS,
  MAX_STACK,
  ROW_MAX,
  ROW_MIN,
  cellMinW,
  clamp,
  cloneRows,
  distributeEven,
  locate,
  rowMinH,
  scaleTo,
  sum,
  takeInOrder,
  takeWidestFirst,
  uid,
  widgetIds,
} from './model';
import { fitRow, normalizeRows } from './normalize';

// Every operation is pure: it takes rows, returns new rows, and the result always
// satisfies the layout invariants (each row exactly 12 columns wide, each stack
// exactly as tall as its row). `minOf(id)` gives a widget's minimum { w, h } and
// `sizeOf(id)` its preferred { w, h }.

const finish = (rows, minOf) => normalizeRows(rows, minOf);

const newRow = (id, size, min) => ({
  id: uid('r'),
  h: clamp(Math.max(size.h, min.h), ROW_MIN, ROW_MAX),
  cells: [{ id: uid('c'), w: COLS, items: [{ id, h: Math.max(size.h, min.h) }] }],
});

// ─── remove ──────────────────────────────────────────────────────────────────

const detach = (rows, id) => {
  const at = locate(rows, id);
  if (!at) {
    return rows;
  }
  const { r, c, i, row, cell, item } = at;
  cell.items.splice(i, 1);
  if (cell.items.length) {
    // The neighbour in the stack absorbs the freed height.
    (cell.items[i - 1] ?? cell.items[i]).h += item.h;
    return rows;
  }
  const wereEqual = row.cells.every((other) => other.w === row.cells[0].w);
  row.cells.splice(c, 1);
  if (!row.cells.length) {
    rows.splice(r, 1);
  } else if (wereEqual) {
    distributeEven(COLS, row.cells.length).forEach((width, index) => {
      row.cells[index].w = width;
    });
  } else {
    // The neighbour across the removed cell takes its width.
    (row.cells[c - 1] ?? row.cells[c]).w += cell.w;
  }
  return rows;
};

export const removeWidget = (input, id, minOf) => finish(detach(cloneRows(input), id), minOf);

// ─── insert ──────────────────────────────────────────────────────────────────

// Moves cells (never `keep`) from the end of `row` into a new row inserted right
// after it, until `room` columns can be freed and the row has a free cell slot.
const evictForRoom = (rows, r, keep, room, minOf) => {
  const row = rows[r];
  const evicted = [];
  const fits = () =>
    row.cells.length < MAX_CELLS &&
    sum(row.cells.map((cell) => cellMinW(cell, minOf))) + room <= COLS;
  while (!fits()) {
    const index = row.cells.findLastIndex((cell) => !keep.includes(cell));
    if (index < 0) {
      break;
    }
    evicted.unshift(...row.cells.splice(index, 1));
  }
  if (evicted.length) {
    rows.splice(r + 1, 0, fitRow({ id: uid('r'), h: row.h, cells: evicted }, minOf));
  }
  return fits();
};

// Places widget `id` in a new cell next to cell `c` of row `r` (side start/end in
// logical order). Width comes from that cell first, then from the widest cells.
const placeBeside = (rows, r, c, side, id, want, minOf) => {
  const min = minOf(id);
  const row = rows[r];
  const anchor = row.cells[c];
  if (!evictForRoom(rows, r, [anchor], min.w, minOf)) {
    rows.splice(r + 1, 0, newRow(id, { w: COLS, h: row.h }, min));
    return rows;
  }
  const widths = row.cells.map((cell) => cell.w);
  const mins = row.cells.map((cell) => cellMinW(cell, minOf));
  const anchorIndex = row.cells.indexOf(anchor);
  const width = clamp(want, min.w, COLS - sum(mins));
  let taken = takeInOrder(widths, mins, [anchorIndex], width);
  taken += takeWidestFirst(widths, mins, width - taken);
  row.cells.forEach((cell, index) => {
    cell.w = widths[index];
  });
  const height = Math.max(row.h, min.h);
  row.cells.splice(side === 'start' ? anchorIndex : anchorIndex + 1, 0, {
    id: uid('c'),
    w: taken,
    items: [{ id, h: height }],
  });
  row.h = clamp(height, ROW_MIN, ROW_MAX);
  fitRow(row, minOf);
  return rows;
};

// Stacks widget `id` above or below widget `of` inside the same cell.
const placeStacked = (rows, of, side, id, minOf) => {
  const at = locate(rows, of);
  const min = minOf(id);
  const { r, row, cell, item } = at;
  if (cell.items.length >= MAX_STACK) {
    return placeBeside(rows, r, at.c, 'end', id, min.w, minOf);
  }
  // The cell must be wide enough for the newcomer.
  if (cell.w < min.w) {
    const widths = row.cells.map((other) => other.w);
    const mins = row.cells.map((other) => cellMinW(other, minOf));
    const need = min.w - cell.w;
    const got = takeWidestFirst(widths, mins, need, at.c);
    if (got < need) {
      rows.splice(r + 1, 0, newRow(id, min, min));
      return rows;
    }
    widths[at.c] += got;
    row.cells.forEach((other, index) => {
      other.w = widths[index];
    });
  }
  const newHeight = Math.max(min.h, Math.floor(item.h / 2));
  item.h = Math.max(1, item.h - newHeight);
  cell.items.splice(side === 'top' ? at.i : at.i + 1, 0, { id, h: newHeight });
  // Grow the row when the stack no longer fits its minimums.
  const stackMin = sum(cell.items.map((other) => minOf(other.id).h));
  if (stackMin > row.h) {
    row.h = clamp(stackMin, ROW_MIN, ROW_MAX);
  }
  fitRow(row, minOf);
  return rows;
};

// target:
//   { kind: 'append' }                               end of the dashboard
//   { kind: 'row', index }                           a new row at that position
//   { kind: 'beside', of, side: 'start' | 'end' }    a new cell next to widget `of`
//   { kind: 'stack', of, side: 'top' | 'bottom' }    stacked with widget `of`
const attach = (rows, id, target, sizeOf, minOf) => {
  const min = minOf(id);
  const size = sizeOf(id);
  switch (target?.kind) {
    case 'row': {
      const index = clamp(target.index ?? rows.length, 0, rows.length);
      rows.splice(index, 0, newRow(id, size, min));
      return rows;
    }
    case 'beside': {
      const at = locate(rows, target.of);
      if (!at) {
        return attach(rows, id, { kind: 'append' }, sizeOf, minOf);
      }
      const want = target.want ?? Math.max(min.w, Math.floor(at.cell.w / 2));
      return placeBeside(
        rows,
        at.r,
        at.c,
        target.side === 'start' ? 'start' : 'end',
        id,
        want,
        minOf,
      );
    }
    case 'stack': {
      if (!locate(rows, target.of)) {
        return attach(rows, id, { kind: 'append' }, sizeOf, minOf);
      }
      return placeStacked(rows, target.of, target.side === 'top' ? 'top' : 'bottom', id, minOf);
    }
    default: {
      const last = rows.at(-1);
      if (
        last &&
        last.cells.length < MAX_CELLS &&
        sum(last.cells.map((cell) => cellMinW(cell, minOf))) + min.w <= COLS
      ) {
        // Width is taken proportionally from the whole row.
        const width = clamp(
          size.w,
          min.w,
          COLS - sum(last.cells.map((cell) => cellMinW(cell, minOf))),
        );
        const scaled = scaleTo(
          last.cells.map((cell) => cell.w),
          COLS - width,
          last.cells.map((cell) => cellMinW(cell, minOf)),
        );
        last.cells.forEach((cell, index) => {
          cell.w = scaled[index];
        });
        last.cells.push({ id: uid('c'), w: width, items: [{ id, h: Math.max(last.h, min.h) }] });
        last.h = clamp(Math.max(last.h, min.h), ROW_MIN, ROW_MAX);
        fitRow(last, minOf);
        return rows;
      }
      rows.push(newRow(id, size, min));
      return rows;
    }
  }
};

export const insertWidget = (input, id, target, sizeOf, minOf) =>
  finish(attach(cloneRows(input), id, target, sizeOf, minOf), minOf);

// ─── move / swap ─────────────────────────────────────────────────────────────

export const swapWidgets = (input, a, b, minOf) => {
  const rows = cloneRows(input);
  const first = locate(rows, a);
  const second = locate(rows, b);
  if (!first || !second || a === b) {
    return input;
  }
  first.item.id = b;
  second.item.id = a;
  return finish(rows, minOf);
};

export const moveWidget = (input, id, target, sizeOf, minOf) => {
  if (!target || target.of === id || target.with === id) {
    return input;
  }
  if (target.kind === 'swap') {
    return swapWidgets(input, id, target.with, minOf);
  }
  const at = locate(input, id);
  if (!at) {
    return input;
  }
  let resolved = target;
  if (target.kind === 'row') {
    // The source row disappears when the widget was alone in it.
    const vanishes = at.row.cells.length === 1 && at.cell.items.length === 1;
    if (vanishes && (target.index === at.r || target.index === at.r + 1)) {
      return input;
    }
    resolved = {
      ...target,
      index: vanishes && at.r < target.index ? target.index - 1 : target.index,
    };
  } else if (target.kind === 'beside') {
    const destination = locate(input, target.of);
    if (destination && destination.cell === at.cell && at.cell.items.length === 1) {
      return input;
    }
    resolved = {
      ...target,
      want: Math.min(
        at.cell.w,
        Math.max(minOf(id).w, Math.floor((destination?.cell.w ?? COLS) / 2)),
      ),
    };
  }
  const rows = detach(cloneRows(input), id);
  return finish(attach(rows, id, resolved, sizeOf, minOf), minOf);
};

// Swaps with the previous or next widget in reading order (keyboard "move earlier/later").
export const moveBy = (input, id, step, minOf) => {
  const ids = widgetIds(input);
  const index = ids.indexOf(id);
  const other = ids[index + step];
  return index < 0 || !other ? input : swapWidgets(input, id, other, minOf);
};

// Gives the widget a row of its own, right below its current row.
export const ownRow = (input, id, sizeOf, minOf) => {
  const at = locate(input, id);
  if (!at || (at.row.cells.length === 1 && at.cell.items.length === 1)) {
    return input;
  }
  const rows = detach(cloneRows(input), id);
  const index = rows.findIndex((row) => row.id === at.row.id);
  return finish(attach(rows, id, { kind: 'row', index: index + 1 }, sizeOf, minOf), minOf);
};

// ─── resize ──────────────────────────────────────────────────────────────────

// Moves the divider between cell k and cell k+1 of a row by `delta` columns
// (positive = toward the inline end). The nearest cells give width first, so the
// whole row stays exactly 12 columns wide. Callers pass the total delta since the
// drag started, applied to the rows as they were when it started.
export const resizeBoundary = (input, rowId, k, delta, minOf) => {
  const rows = cloneRows(input);
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row || k < 0 || k >= row.cells.length - 1 || !delta) {
    return input;
  }
  const widths = row.cells.map((cell) => cell.w);
  const mins = row.cells.map((cell) => cellMinW(cell, minOf));
  if (delta > 0) {
    const order = widths.map((_, index) => index).filter((index) => index > k);
    widths[k] += takeInOrder(widths, mins, order, delta);
  } else {
    const order = widths
      .map((_, index) => index)
      .filter((index) => index <= k)
      .reverse();
    widths[k + 1] += takeInOrder(widths, mins, order, -delta);
  }
  row.cells.forEach((cell, index) => {
    cell.w = widths[index];
  });
  return rows;
};

// Sets the width of the cell holding widget `id` (presets: 3, 4, 6, 8, 9, 12). The
// other cells scale proportionally; cells that no longer fit move to a new row right
// below, so the rest of the dashboard adapts instead of leaving a gap.
export const setCellWidth = (input, id, width, minOf) => {
  const rows = cloneRows(input);
  const at = locate(rows, id);
  if (!at) {
    return input;
  }
  const { r, row, cell } = at;
  const target = clamp(width, cellMinW(cell, minOf), COLS);
  const need = COLS - target;
  const others = () => row.cells.filter((other) => other !== cell);
  const evicted = [];
  const minsOf = (cells) => sum(cells.map((other) => cellMinW(other, minOf)));
  while (others().length && (need === 0 || minsOf(others()) > need)) {
    // Evict the cell farthest from the resized one, the inline end first.
    const index = row.cells.indexOf(cell);
    const victim = index < row.cells.length - 1 ? row.cells.length - 1 : 0;
    evicted.push({ cell: row.cells[victim], after: victim > index });
    row.cells.splice(victim, 1);
  }
  if (!others().length) {
    cell.w = COLS;
  } else {
    const rest = others();
    const scaled = scaleTo(
      rest.map((other) => other.w),
      need,
      rest.map((other) => cellMinW(other, minOf)),
    );
    rest.forEach((other, index) => {
      other.w = scaled[index];
    });
    cell.w = target;
  }
  if (evicted.length) {
    // The evicted cells keep their reading order in the new row below. Cells before the
    // resized one were removed from the start (already in order), cells after it from
    // the end (reversed).
    const ordered = [
      ...evicted.filter((entry) => !entry.after),
      ...evicted.filter((entry) => entry.after).reverse(),
    ].map((entry) => entry.cell);
    rows.splice(r + 1, 0, fitRow({ id: uid('r'), h: row.h, cells: ordered }, minOf));
  }
  return finish(rows, minOf);
};

export const setRowHeight = (input, rowId, height, minOf) => {
  const rows = cloneRows(input);
  const row = rows.find((candidate) => candidate.id === rowId);
  if (!row) {
    return input;
  }
  const target = clamp(height, rowMinH(row, minOf), ROW_MAX);
  row.cells.forEach((cell) => {
    const scaled = scaleTo(
      cell.items.map((item) => item.h),
      target,
      cell.items.map((item) => minOf(item.id).h),
    );
    cell.items.forEach((item, index) => {
      item.h = scaled[index];
    });
  });
  row.h = target;
  return rows;
};

// Moves the divider between stacked widgets i and i+1 of a cell by `delta` units.
export const resizeStackBoundary = (input, cellId, i, delta, minOf) => {
  const rows = cloneRows(input);
  const cell = rows.flatMap((row) => row.cells).find((candidate) => candidate.id === cellId);
  if (!cell || i < 0 || i >= cell.items.length - 1 || !delta) {
    return input;
  }
  const heights = cell.items.map((item) => item.h);
  const mins = cell.items.map((item) => minOf(item.id).h);
  if (delta > 0) {
    const order = heights.map((_, index) => index).filter((index) => index > i);
    heights[i] += takeInOrder(heights, mins, order, delta);
  } else {
    const order = heights
      .map((_, index) => index)
      .filter((index) => index <= i)
      .reverse();
    heights[i + 1] += takeInOrder(heights, mins, order, -delta);
  }
  cell.items.forEach((item, index) => {
    item.h = heights[index];
  });
  return rows;
};

// Height preset for one widget: a widget alone in its cell sets the row height; a
// stacked widget takes height from its stack, and the row grows when that isn't enough.
export const setWidgetHeight = (input, id, height, minOf) => {
  const at = locate(input, id);
  if (!at) {
    return input;
  }
  if (at.cell.items.length === 1) {
    return setRowHeight(input, at.row.id, height, minOf);
  }
  const rows = cloneRows(input);
  const { row, cell, i } = locate(rows, id);
  const target = clamp(height, minOf(id).h, ROW_MAX);
  const others = cell.items.filter((_, index) => index !== i);
  const otherMins = others.map((item) => minOf(item.id).h);
  if (sum(otherMins) + target > row.h) {
    row.h = clamp(target + sum(others.map((item) => item.h)), ROW_MIN, ROW_MAX);
  }
  const rest = row.h - target;
  const scaled = scaleTo(
    others.map((item) => item.h),
    rest,
    otherMins,
  );
  if (scaled) {
    others.forEach((item, index) => {
      item.h = scaled[index];
    });
    cell.items[i].h = target;
  }
  return finish(rows, minOf);
};

// A copy of widget `id` (already registered under `copyId`) placed right after it.
export const duplicateWidget = (input, id, copyId, sizeOf, minOf) => {
  const at = locate(input, id);
  if (!at) {
    return input;
  }
  return insertWidget(input, copyId, { kind: 'beside', of: id, side: 'end' }, sizeOf, minOf);
};
