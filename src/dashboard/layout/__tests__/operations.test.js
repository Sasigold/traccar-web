import { describe, expect, it } from 'vitest';
import { COLS, distributeEven, scaleTo, sum, widgetIds } from '../model';
import { checkRows, normalizeRows } from '../normalize';
import {
  insertWidget,
  moveBy,
  moveWidget,
  ownRow,
  removeWidget,
  resizeBoundary,
  resizeStackBoundary,
  setCellWidth,
  setRowHeight,
  setWidgetHeight,
  swapWidgets,
} from '../operations';

// Every widget: minimum 3 columns × 2 units, preferred 4 × 5, unless listed.
const mins = { big: { w: 6, h: 4 }, kpi: { w: 2, h: 2 }, tall: { w: 3, h: 6 } };
const minOf = (id) => mins[id.replace(/\d+$/, '')] ?? { w: 3, h: 2 };
const sizeOf = () => ({ w: 4, h: 5 });

const row = (id, h, ...cells) => ({ id, h, cells });
const cell = (id, w, ...items) => ({ id, w, items: items.map(([wid, h]) => ({ id: wid, h })) });

const widths = (rows) => rows.map((r) => r.cells.map((c) => c.w));
const layout = () => [
  row('r1', 5, cell('c1', 4, ['a', 5]), cell('c2', 4, ['b', 5]), cell('c3', 4, ['c', 5])),
  row('r2', 6, cell('c4', 8, ['d', 6]), cell('c5', 4, ['e', 3], ['f', 3])),
];

describe('apportionment', () => {
  it('keeps weights that already fit', () => {
    expect(scaleTo([4, 4, 4], 12, [3, 3, 3])).toEqual([4, 4, 4]);
  });

  it('scales proportionally with integer results that add up', () => {
    const result = scaleTo([6, 6], 9, [3, 3]);
    expect(sum(result)).toBe(9);
    expect(result).toEqual([5, 4]);
  });

  it('respects minimums and refuses impossible totals', () => {
    expect(scaleTo([10, 1], 8, [3, 3])).toEqual([5, 3]);
    expect(scaleTo([4, 4], 5, [3, 3])).toBeNull();
  });

  it('splits evenly with the remainder first', () => {
    expect(distributeEven(12, 5)).toEqual([3, 3, 2, 2, 2]);
  });
});

describe('remove', () => {
  it('spreads the width evenly when all cells were equal', () => {
    const rows = removeWidget(layout(), 'b', minOf);
    expect(widths(rows)[0]).toEqual([6, 6]);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('gives the width to the neighbour when cells were unequal', () => {
    const rows = removeWidget(layout(), 'e', minOf);
    expect(widths(rows)[1]).toEqual([8, 4]);
    const both = removeWidget(rows, 'f', minOf);
    expect(widths(both)[1]).toEqual([12]);
  });

  it('lets the stack neighbour take the freed height', () => {
    const rows = removeWidget(layout(), 'e', minOf);
    expect(rows[1].cells[1].items).toEqual([{ id: 'f', h: 6 }]);
  });

  it('drops a row that becomes empty', () => {
    let rows = removeWidget(layout(), 'd', minOf);
    rows = removeWidget(rows, 'e', minOf);
    rows = removeWidget(rows, 'f', minOf);
    expect(rows).toHaveLength(1);
  });
});

describe('insert', () => {
  it('appends to the last row when it has room', () => {
    const rows = insertWidget(
      [row('r', 5, cell('c', 12, ['a', 5]))],
      'x',
      { kind: 'append' },
      sizeOf,
      minOf,
    );
    expect(widths(rows)).toEqual([[8, 4]]);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('opens a new row when the last row is full', () => {
    const rows = insertWidget([layout()[0]], 'big', { kind: 'append' }, sizeOf, minOf);
    expect(rows).toHaveLength(2);
    expect(widths(rows)[1]).toEqual([12]);
  });

  it('splits the target cell when dropped beside it', () => {
    const rows = insertWidget(
      [row('r', 5, cell('c1', 6, ['a', 5]), cell('c2', 6, ['b', 5]))],
      'x',
      { kind: 'beside', of: 'b', side: 'end' },
      sizeOf,
      minOf,
    );
    expect(widths(rows)).toEqual([[6, 3, 3]]);
    expect(rows[0].cells.map((c) => c.items[0].id)).toEqual(['a', 'b', 'x']);
  });

  it('places beside at the logical start', () => {
    const rows = insertWidget(
      layout(),
      'x',
      { kind: 'beside', of: 'd', side: 'start' },
      sizeOf,
      minOf,
    );
    expect(rows[1].cells[0].items[0].id).toBe('x');
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('moves trailing cells to a new row when there is no room beside', () => {
    const full = [
      row('r', 5, cell('c1', 4, ['a', 5]), cell('c2', 4, ['b', 5]), cell('c3', 4, ['c', 5])),
    ];
    const rows = insertWidget(full, 'big', { kind: 'beside', of: 'a', side: 'end' }, sizeOf, minOf);
    expect(checkRows(rows, minOf)).toBe(true);
    expect(widgetIds(rows)).toEqual(['a', 'big', 'b', 'c']);
    expect(rows.length).toBe(2);
  });

  it('stacks inside a cell and keeps the row height', () => {
    const rows = insertWidget(
      layout(),
      'x',
      { kind: 'stack', of: 'd', side: 'bottom' },
      sizeOf,
      minOf,
    );
    const target = rows[1].cells[0];
    expect(target.items.map((i) => i.id)).toEqual(['d', 'x']);
    expect(sum(target.items.map((i) => i.h))).toBe(rows[1].h);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('grows the row when the stack needs more height', () => {
    const rows = insertWidget(
      layout(),
      'tall',
      { kind: 'stack', of: 'a', side: 'top' },
      sizeOf,
      minOf,
    );
    expect(rows[0].h).toBeGreaterThanOrEqual(8);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('falls back beside when a stack is already full', () => {
    let rows = insertWidget(
      layout(),
      'x',
      { kind: 'stack', of: 'e', side: 'bottom' },
      sizeOf,
      minOf,
    );
    rows = insertWidget(rows, 'y', { kind: 'stack', of: 'e', side: 'bottom' }, sizeOf, minOf);
    expect(checkRows(rows, minOf)).toBe(true);
    expect(rows.flatMap((r) => r.cells).every((c) => c.items.length <= 3)).toBe(true);
    expect(widgetIds(rows)).toContain('y');
  });

  it('inserts a new full-width row at a position', () => {
    const rows = insertWidget(layout(), 'x', { kind: 'row', index: 1 }, sizeOf, minOf);
    expect(rows[1].cells).toHaveLength(1);
    expect(rows[1].cells[0].items[0].id).toBe('x');
  });
});

describe('move', () => {
  it('swaps two widgets and keeps the slots', () => {
    const rows = swapWidgets(layout(), 'a', 'd', minOf);
    expect(rows[0].cells[0].items[0].id).toBe('d');
    expect(rows[1].cells[0].items[0].id).toBe('a');
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('moves a widget into another row and closes the gap it left', () => {
    const rows = moveWidget(layout(), 'b', { kind: 'beside', of: 'd', side: 'end' }, sizeOf, minOf);
    expect(widths(rows)[0]).toEqual([6, 6]);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('moving the only widget of a row next to itself changes nothing', () => {
    const rows = [row('r1', 5, cell('c1', 12, ['a', 5])), row('r2', 5, cell('c2', 12, ['b', 5]))];
    expect(moveWidget(rows, 'a', { kind: 'row', index: 1 }, sizeOf, minOf)).toBe(rows);
    expect(moveWidget(rows, 'a', { kind: 'row', index: 0 }, sizeOf, minOf)).toBe(rows);
    const moved = moveWidget(rows, 'a', { kind: 'row', index: 2 }, sizeOf, minOf);
    expect(widgetIds(moved)).toEqual(['b', 'a']);
  });

  it('moves earlier and later in reading order', () => {
    expect(widgetIds(moveBy(layout(), 'b', -1, minOf))).toEqual(['b', 'a', 'c', 'd', 'e', 'f']);
    expect(widgetIds(moveBy(layout(), 'f', 1, minOf))).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('gives a widget its own row below', () => {
    const rows = ownRow(layout(), 'b', sizeOf, minOf);
    expect(rows).toHaveLength(3);
    expect(widgetIds(rows)).toEqual(['a', 'c', 'b', 'd', 'e', 'f']);
    expect(widths(rows)[1]).toEqual([12]);
  });
});

describe('resize', () => {
  it('moves a divider and keeps the row full', () => {
    const rows = resizeBoundary(layout(), 'r1', 0, 2, minOf);
    expect(widths(rows)[0]).toEqual([6, 3, 3]);
  });

  it('takes from the nearest neighbour first and stops at the minimums', () => {
    const rows = resizeBoundary(layout(), 'r1', 0, 5, minOf);
    expect(widths(rows)[0]).toEqual([6, 3, 3]);
    const back = resizeBoundary(layout(), 'r1', 1, -5, minOf);
    expect(widths(back)[0]).toEqual([3, 3, 6]);
  });

  it('a width preset makes the others adapt', () => {
    const rows = setCellWidth(layout(), 'a', 6, minOf);
    expect(widths(rows)[0]).toEqual([6, 3, 3]);
  });

  it('a width preset moves cells that no longer fit to a new row', () => {
    const rows = setCellWidth(layout(), 'a', 8, minOf);
    expect(checkRows(rows, minOf)).toBe(true);
    expect(rows[0].cells[0].w).toBe(8);
    expect(rows).toHaveLength(3);
    expect(widgetIds(rows)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('full width moves every neighbour below in order', () => {
    const rows = setCellWidth(layout(), 'b', 12, minOf);
    expect(widths(rows)[0]).toEqual([12]);
    expect(widgetIds(rows)).toEqual(['b', 'a', 'c', 'd', 'e', 'f']);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('row height rescales every stack', () => {
    const rows = setRowHeight(layout(), 'r2', 10, minOf);
    expect(rows[1].h).toBe(10);
    expect(rows[1].cells[1].items.map((i) => i.h)).toEqual([5, 5]);
    expect(setRowHeight(layout(), 'r2', 1, minOf)[1].h).toBe(4);
  });

  it('moves the divider between stacked widgets', () => {
    const rows = resizeStackBoundary(layout(), 'c5', 0, 1, minOf);
    expect(rows[1].cells[1].items.map((i) => i.h)).toEqual([4, 2]);
  });

  it('a stacked widget height preset grows the row when needed', () => {
    const rows = setWidgetHeight(layout(), 'e', 7, minOf);
    expect(checkRows(rows, minOf)).toBe(true);
    expect(rows[1].cells[1].items[0].h).toBe(7);
  });
});

describe('normalize', () => {
  it('repairs garbage without throwing', () => {
    const rows = normalizeRows(
      [
        null,
        { cells: 'x' },
        {
          h: 'abc',
          cells: [{ w: 99, items: [{ id: 'a', h: -3 }, { id: 'a' }, 5] }, { items: [] }],
        },
        {
          h: 40,
          cells: [
            { w: 1, items: [{ id: 'b' }] },
            { w: 1, items: [{ id: 'gone' }] },
          ],
        },
      ],
      minOf,
      (id) => id !== 'gone',
    );
    expect(widgetIds(rows)).toEqual(['a', 'b']);
    expect(checkRows(rows, minOf)).toBe(true);
  });

  it('splits rows whose cells cannot fit', () => {
    const cells = Array.from({ length: 8 }, (_, index) => cell(`c${index}`, 2, [`w${index}`, 4]));
    const rows = normalizeRows([row('r', 4, ...cells)], minOf);
    expect(rows.length).toBeGreaterThan(1);
    expect(checkRows(rows, minOf)).toBe(true);
    expect(widgetIds(rows)).toHaveLength(8);
  });

  it('leaves a valid layout untouched', () => {
    expect(normalizeRows(layout(), minOf)).toEqual(layout());
  });
});

describe('invariants under random edits', () => {
  // A small deterministic PRNG so failures are reproducible.
  const random = (seed) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %i keeps every row full', (seed) => {
    const next = random(seed);
    const pick = (list) => list[Math.floor(next() * list.length)];
    let rows = layout();
    let counter = 0;
    for (let step = 0; step < 300; step += 1) {
      const ids = widgetIds(rows);
      const id = pick(ids);
      const other = pick(ids);
      const action = Math.floor(next() * 11);
      const kinds = ['big', 'kpi', 'tall', 'w'];
      switch (action) {
        case 0:
          if (ids.length < 30) {
            counter += 1;
            rows = insertWidget(
              rows,
              `${pick(kinds)}${counter}`,
              { kind: 'append' },
              sizeOf,
              minOf,
            );
          }
          break;
        case 1:
          if (ids.length > 1) {
            rows = removeWidget(rows, id, minOf);
          }
          break;
        case 2:
          rows = moveWidget(
            rows,
            id,
            { kind: 'beside', of: other, side: next() < 0.5 ? 'start' : 'end' },
            sizeOf,
            minOf,
          );
          break;
        case 3:
          rows = moveWidget(
            rows,
            id,
            { kind: 'stack', of: other, side: next() < 0.5 ? 'top' : 'bottom' },
            sizeOf,
            minOf,
          );
          break;
        case 4:
          rows = moveWidget(
            rows,
            id,
            { kind: 'row', index: Math.floor(next() * (rows.length + 1)) },
            sizeOf,
            minOf,
          );
          break;
        case 5:
          rows = moveWidget(rows, id, { kind: 'swap', with: other }, sizeOf, minOf);
          break;
        case 6: {
          const target = pick(rows);
          rows = resizeBoundary(
            rows,
            target.id,
            Math.floor(next() * target.cells.length),
            Math.floor(next() * 13) - 6,
            minOf,
          );
          break;
        }
        case 7:
          rows = setCellWidth(rows, id, pick([3, 4, 6, 8, 9, 12]), minOf);
          break;
        case 8:
          rows = setRowHeight(rows, pick(rows).id, Math.floor(next() * 18), minOf);
          break;
        case 9:
          rows = setWidgetHeight(rows, id, Math.floor(next() * 12), minOf);
          break;
        default: {
          const target = pick(rows.flatMap((r) => r.cells));
          rows = resizeStackBoundary(
            rows,
            target.id,
            Math.floor(next() * target.items.length),
            Math.floor(next() * 7) - 3,
            minOf,
          );
        }
      }
      if (!checkRows(rows, minOf)) {
        throw new Error(
          `invariant broken after action ${action} at step ${step}: ${JSON.stringify(rows)}`,
        );
      }
      expect(new Set(widgetIds(rows)).size).toBe(widgetIds(rows).length);
      expect(rows.every((r) => sum(r.cells.map((c) => c.w)) === COLS)).toBe(true);
    }
  });
});
