import { describe, expect, it } from 'vitest';
import { groupRows, rowOfDevice, sortByGroup } from '../groupRows';

const groups = { 1: { id: 1, name: 'צפון' }, 2: { id: 2, name: 'דרום' } };
const devices = [
  { id: 10, name: 'B', groupId: 1, status: 'online' },
  { id: 11, name: 'A', groupId: 1, status: 'offline' },
  { id: 12, name: 'C', groupId: 2, status: 'online' },
  { id: 13, name: 'D', groupId: 0, status: 'unknown' },
];

describe('the list by group (LIV-22)', () => {
  it('sorts by group name, then vehicle name, without a group last', () => {
    expect(sortByGroup(devices, groups).map((d) => d.id)).toEqual([12, 11, 10, 13]);
  });

  it('puts a header with counts above each group', () => {
    const sorted = sortByGroup(devices, groups);
    const rows = groupRows(sorted, groups);
    expect(rows.map((row) => (row.type === 'group' ? `#${row.name}` : row.index))).toEqual([
      '#דרום',
      0,
      '#צפון',
      1,
      2,
      '#null',
      3,
    ]);
    expect(rows[2]).toMatchObject({ count: 2, online: 1, offline: 1 });
  });

  it('keeps only the header of a collapsed group', () => {
    const sorted = sortByGroup(devices, groups);
    const rows = groupRows(sorted, groups, [1]);
    expect(rows.filter((row) => row.type === 'device').map((row) => row.index)).toEqual([0, 3]);
    expect(rowOfDevice(rows, 1)).toBe(-1);
    expect(rowOfDevice(rows, 3)).toBe(4);
  });
});
