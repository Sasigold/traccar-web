import { describe, expect, it } from 'vitest';
import { filterRows, sortRows } from '../listRows';

const rows = [
  { id: 1, status: 'open', number: 12, vehicles: { plate_number: '12-345-67' } },
  { id: 2, status: 'closed', number: 13, vehicles: null },
  { id: 3, status: 'open', number: 140, vehicles: { plate_number: '99-111-22' } },
];
const filters = [{ key: 'open', test: (row) => row.status === 'open' }, { key: 'all' }];
const searchOf = (row) => [row.vehicles?.plate_number, row.number];
const ids = (list) => list.map((row) => row.id);

describe('filterRows (ARC-10)', () => {
  it('applies the chosen chip', () => {
    expect(ids(filterRows(rows, { filters, filter: 'open', searchOf, search: '' }))).toEqual([
      1, 3,
    ]);
    expect(filterRows(rows, { filters, filter: 'all', searchOf, search: '' })).toHaveLength(3);
  });

  it('searches the fields the page names, numbers included, ignoring empty ones', () => {
    expect(ids(filterRows(rows, { filters, filter: 'all', searchOf, search: ' 99-1 ' }))).toEqual([
      3,
    ]);
    expect(ids(filterRows(rows, { filters, filter: 'all', searchOf, search: '13' }))).toEqual([2]);
    expect(filterRows(rows, { filters, filter: 'open', searchOf, search: '13' })).toEqual([]);
  });

  it('shows nothing while the rows are not loaded', () => {
    expect(filterRows(undefined, { filters, filter: 'all', searchOf, search: '' })).toEqual([]);
  });
});

describe('sortRows (ADM-15)', () => {
  const list = [
    { id: 1, n: 10, name: 'שמשון' },
    { id: 2, n: 2, name: 'אבי' },
    { id: 3, n: null, name: '' },
    { id: 4, n: 33, name: 'בני' },
  ];

  it('orders numbers by value and text in Hebrew order, empty values last both ways', () => {
    expect(ids(sortRows(list, (row) => row.n, 'asc'))).toEqual([2, 1, 4, 3]);
    expect(ids(sortRows(list, (row) => row.n, 'desc'))).toEqual([4, 1, 2, 3]);
    expect(ids(sortRows(list, (row) => row.name, 'asc'))).toEqual([2, 4, 1, 3]);
  });

  it('keeps the order when no column is chosen', () => {
    expect(sortRows(list, null)).toBe(list);
  });
});
