import { describe, expect, it } from 'vitest';
import { coveredDevices, pickerRows, toggleDevice, toggleGroup } from '../pickerRows';

const groups = { 1: { id: 1, name: 'צפון' }, 2: { id: 2, name: 'מרכז' } };
const devices = {
  1: {
    id: 1,
    name: 'טנדר 12',
    groupId: 1,
    uniqueId: '860001',
    attributes: { plateNumber: '12-345-67' },
  },
  2: { id: 2, name: 'משאית', groupId: 1, uniqueId: '860002', attributes: {} },
  3: {
    id: 3,
    name: 'רכב מנהל',
    groupId: 2,
    uniqueId: '860003',
    attributes: { plateNumber: '345-67-890' },
  },
  4: { id: 4, name: 'גרור', groupId: 0, uniqueId: '860004', attributes: {} },
};

describe('vehicle picker (REP-05)', () => {
  it('lists groups as headings with their vehicles, vehicles without a group last', () => {
    const rows = pickerRows(devices, groups);
    expect(rows.map((row) => `${row.type}:${row.name}`)).toEqual([
      'group:מרכז',
      'device:רכב מנהל',
      'group:צפון',
      'device:טנדר 12',
      'device:משאית',
      'group:null',
      'device:גרור',
    ]);
    expect(rows[2].deviceIds).toEqual([1, 2]);
    expect(rows[3].plate).toBe('12-345-67');
  });

  it('finds a vehicle by plate digits, identifier or name, and a whole group by its name', () => {
    expect(
      pickerRows(devices, groups, '1234567')
        .filter((row) => row.type === 'device')
        .map((row) => row.id),
    ).toEqual([1]);
    expect(
      pickerRows(devices, groups, '860003')
        .filter((row) => row.type === 'device')
        .map((row) => row.id),
    ).toEqual([3]);
    expect(
      pickerRows(devices, groups, 'צפון')
        .filter((row) => row.type === 'device')
        .map((row) => row.id),
    ).toEqual([1, 2]);
    expect(pickerRows(devices, groups, 'nothing')).toEqual([]);
  });

  it('chooses a group, then all of it except one vehicle', () => {
    let selection = toggleGroup(devices, { deviceIds: [1], groupIds: [] }, 1);
    expect(selection).toEqual({ groupIds: [1], deviceIds: [] });
    expect([...coveredDevices(devices, selection)].sort()).toEqual([1, 2]);
    selection = toggleDevice(devices, selection, 2);
    expect(selection).toEqual({ groupIds: [], deviceIds: [1] });
    selection = toggleDevice(devices, selection, 3);
    expect(selection.deviceIds).toEqual([1, 3]);
    expect(toggleDevice(devices, selection, 3).deviceIds).toEqual([1]);
  });

  it('"all" covers every vehicle', () => {
    expect(coveredDevices(devices, { deviceIds: ['all'] }).size).toBe(4);
  });
});
