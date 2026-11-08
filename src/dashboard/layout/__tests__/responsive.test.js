import { describe, expect, it } from 'vitest';
import { hitTest } from '../hitTest';
import { isGapless, layoutMode, toVisual } from '../responsive';

const info = { kpi: { w: 2, h: 2, mobileH: 3, pair: true }, chart: { w: 4, h: 4, mobileH: 6 } };
const infoOf = (id) => info[id.replace(/\d+$/, '')];
const rows = [
  {
    id: 'r1',
    h: 2,
    cells: ['kpi1', 'kpi2', 'kpi3', 'kpi4'].map((id) => ({
      id: `c${id}`,
      w: 3,
      items: [{ id, h: 2 }],
    })),
  },
  {
    id: 'r2',
    h: 6,
    cells: [
      { id: 'cA', w: 4, items: [{ id: 'chart1', h: 6 }] },
      { id: 'cB', w: 4, items: [{ id: 'chart2', h: 6 }] },
      {
        id: 'cC',
        w: 4,
        items: [
          { id: 'chart3', h: 3 },
          { id: 'kpi5', h: 3 },
        ],
      },
    ],
  },
];

describe('responsive layout', () => {
  it('picks the mode from the width', () => {
    expect(layoutMode(1200)).toBe('wide');
    expect(layoutMode(800)).toBe('medium');
    expect(layoutMode(390)).toBe('narrow');
  });

  it('keeps the saved layout on wide screens', () => {
    const lines = toVisual(rows, 1280, infoOf);
    expect(lines.map((line) => line.cells.map((cell) => cell.w))).toEqual([
      [3, 3, 3, 3],
      [4, 4, 4],
    ]);
  });

  it('wraps rows on medium screens and every line stays full', () => {
    const lines = toVisual(rows, 640, infoOf);
    expect(lines.length).toBeGreaterThan(2);
    expect(isGapless(lines)).toBe(true);
  });

  it('stacks widgets on phones and pairs compact tiles', () => {
    const lines = toVisual(rows, 390, infoOf);
    expect(isGapless(lines)).toBe(true);
    expect(lines[0].cells.map((cell) => cell.w)).toEqual([6, 6]);
    expect(lines.find((line) => line.cells[0].items[0].id === 'chart1').cells).toHaveLength(1);
    expect(lines.find((line) => line.cells[0].items[0].id === 'chart1').h).toBe(6);
  });
});

describe('drop targets', () => {
  const widgets = [
    { id: 'a', left: 0, top: 0, right: 400, bottom: 300 },
    { id: 'b', left: 416, top: 0, right: 816, bottom: 300 },
    { id: 'c', left: 0, top: 316, right: 816, bottom: 600 },
  ];
  const rowRects = [
    { index: 0, top: 0, bottom: 300 },
    { index: 1, top: 316, bottom: 600 },
  ];

  it('finds the edges of a widget in reading direction', () => {
    expect(hitTest({ x: 10, y: 150 }, widgets, rowRects, 'ltr')).toEqual({
      kind: 'beside',
      of: 'a',
      side: 'start',
    });
    expect(hitTest({ x: 10, y: 150 }, widgets, rowRects, 'rtl')).toEqual({
      kind: 'beside',
      of: 'a',
      side: 'end',
    });
    expect(hitTest({ x: 800, y: 150 }, widgets, rowRects, 'rtl')).toEqual({
      kind: 'beside',
      of: 'b',
      side: 'start',
    });
  });

  it('stacks on the top and bottom bands and swaps in the middle', () => {
    expect(hitTest({ x: 200, y: 40 }, widgets, rowRects)).toEqual({
      kind: 'stack',
      of: 'a',
      side: 'top',
    });
    expect(hitTest({ x: 200, y: 280 }, widgets, rowRects)).toEqual({
      kind: 'stack',
      of: 'a',
      side: 'bottom',
    });
    expect(hitTest({ x: 200, y: 150 }, widgets, rowRects)).toEqual({ kind: 'swap', with: 'a' });
  });

  it('opens a new row between rows and at both ends', () => {
    expect(hitTest({ x: 200, y: 308 }, widgets, rowRects)).toEqual({ kind: 'row', index: 1 });
    expect(hitTest({ x: 200, y: -10 }, widgets, rowRects)).toEqual({ kind: 'row', index: 0 });
    expect(hitTest({ x: 200, y: 640 }, widgets, rowRects)).toEqual({ kind: 'row', index: 2 });
  });

  it('ignores the dragged widget itself', () => {
    expect(hitTest({ x: 200, y: 150 }, widgets, rowRects, 'ltr', 'a')).toBeNull();
  });
});
