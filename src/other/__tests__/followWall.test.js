import { describe, expect, it } from 'vitest';
import { wallVehicles } from '../followWall';

const devices = {
  1: { id: 1, name: 'A', groupId: 10, status: 'offline' },
  2: { id: 2, name: 'B', groupId: 10, status: 'online' },
  3: { id: 3, name: 'C', groupId: 20, status: 'online' },
  4: { id: 4, name: 'D', status: 'online' },
};
const groups = {
  10: { id: 10, name: 'צפון' },
  20: { id: 20, name: 'דרום' },
  30: { id: 30, name: 'ריק' },
};

describe('the follow wall (LIV-28)', () => {
  it('shows the chosen vehicles that exist', () => {
    expect(wallVehicles({ chosen: ['3', '9', '1'], rotate: 0, tick: 0, devices, groups })).toEqual({
      ids: [3, 1],
      groupName: null,
    });
  });

  it('goes through the groups with vehicles, online first', () => {
    const first = wallVehicles({ chosen: [], rotate: 30, tick: 0, devices, groups });
    expect(first).toEqual({ ids: [3], groupName: 'דרום' });
    const second = wallVehicles({ chosen: [], rotate: 30, tick: 1, devices, groups });
    expect(second).toEqual({ ids: [2, 1], groupName: 'צפון' });
    expect(wallVehicles({ chosen: [], rotate: 30, tick: 2, devices, groups }).groupName).toBe(
      'דרום',
    );
  });
});
