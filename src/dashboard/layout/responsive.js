import { COLS, GAP, cellMinW, scaleTo, sum } from './model';

// Render-time adaptation of the saved layout to the available width. Nothing here is
// saved. Every visual line still adds up to 12 columns, so nothing leaves a gap.
//
//   wide   (>= DESIGN_WIDTH): the saved layout as is; pointer editing allowed
//   medium : a row whose cells would get narrower than their minimum wraps into
//            extra lines, each still full width
//   narrow (< NARROW_WIDTH): one widget per line; compact widgets pair up 6/6

export const DESIGN_WIDTH = 960;
export const NARROW_WIDTH = 600;

const REFERENCE_COLUMN = (DESIGN_WIDTH - (COLS - 1) * GAP) / COLS;

export const layoutMode = (width) => {
  if (width >= DESIGN_WIDTH) {
    return 'wide';
  }
  return width >= NARROW_WIDTH ? 'medium' : 'narrow';
};

const minPx = (columns, gap) => columns * REFERENCE_COLUMN + (columns - 1) * gap;

export const minColumnsAt = (columns, width, gap = GAP) => {
  const columnPx = (width - (COLS - 1) * gap) / COLS;
  return Math.min(COLS, Math.ceil((minPx(columns, gap) + gap) / (columnPx + gap)));
};

// rows → [{ key, h, cells: [{ key, w, items: [{ id, h }] }] }]
// infoOf(id) → { w, h, mobileH, pair }
export const toVisual = (rows, width, infoOf, gap = GAP) => {
  const mode = layoutMode(width);
  if (mode === 'wide') {
    return rows.map((row) => ({
      key: row.id,
      rowId: row.id,
      h: row.h,
      cells: row.cells.map((cell) => ({
        key: cell.id,
        cellId: cell.id,
        w: cell.w,
        items: cell.items,
      })),
    }));
  }
  if (mode === 'medium') {
    return rows.flatMap((row) => {
      const needs = row.cells.map((cell) => minColumnsAt(cellMinW(cell, infoOf), width, gap));
      if (row.cells.every((cell, index) => cell.w >= needs[index])) {
        return [
          {
            key: row.id,
            rowId: row.id,
            h: row.h,
            cells: row.cells.map((cell) => ({
              key: cell.id,
              cellId: cell.id,
              w: cell.w,
              items: cell.items,
            })),
          },
        ];
      }
      const lines = [];
      let line = [];
      let used = 0;
      row.cells.forEach((cell, index) => {
        if (line.length && used + needs[index] > COLS) {
          lines.push(line);
          line = [];
          used = 0;
        }
        line.push(index);
        used += needs[index];
      });
      if (line.length) {
        lines.push(line);
      }
      return lines.map((indexes, lineIndex) => {
        const widths =
          scaleTo(
            indexes.map((index) => row.cells[index].w),
            COLS,
            indexes.map((index) => needs[index]),
          ) ?? indexes.map(() => COLS / indexes.length);
        return {
          key: `${row.id}:${lineIndex}`,
          rowId: row.id,
          h: row.h,
          cells: indexes.map((index, position) => ({
            key: row.cells[index].id,
            cellId: row.cells[index].id,
            w: widths[position],
            items: row.cells[index].items,
          })),
        };
      });
    });
  }
  // Narrow: one widget per line, compact ones (KPI tiles) two per line.
  const items = rows.flatMap((row) =>
    row.cells.flatMap((cell) =>
      cell.items.map((item) => ({
        id: item.id,
        h: Math.max(infoOf(item.id).mobileH ?? item.h, infoOf(item.id).h),
        pair: Boolean(infoOf(item.id).pair),
      })),
    ),
  );
  const lines = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const next = items[index + 1];
    if (item.pair && next?.pair) {
      const h = Math.max(item.h, next.h);
      lines.push({
        key: `m:${item.id}`,
        h,
        cells: [
          { key: item.id, w: 6, items: [{ id: item.id, h }] },
          { key: next.id, w: 6, items: [{ id: next.id, h }] },
        ],
      });
      index += 1;
    } else {
      lines.push({
        key: `m:${item.id}`,
        h: item.h,
        cells: [{ key: item.id, w: COLS, items: [{ id: item.id, h: item.h }] }],
      });
    }
  }
  return lines;
};

// True when every visual line adds up to 12 columns and every stack to its line height.
export const isGapless = (lines) =>
  lines.every(
    (line) =>
      sum(line.cells.map((cell) => cell.w)) === COLS &&
      line.cells.every((cell) => sum(cell.items.map((item) => item.h)) === line.h),
  );
