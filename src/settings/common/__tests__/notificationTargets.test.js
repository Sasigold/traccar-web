import { describe, expect, it, vi } from 'vitest';
import { loadTargets, permissionBodies, targetChanges } from '../notificationTargets';

describe('notification targets (ADM-25)', () => {
  it('finds what to link and unlink', () => {
    expect(targetChanges([1, 2, 3], [2, 3, 4])).toEqual({ add: [4], remove: [1] });
    expect(targetChanges([], [])).toEqual({ add: [], remove: [] });
  });

  it('reads the current links per vehicle, a batch at a time', async () => {
    const fetchNotifications = vi.fn(async (deviceId) =>
      deviceId % 2 ? [{ id: 9 }, { id: 1 }] : [{ id: 1 }],
    );
    expect(await loadTargets(9, [1, 2, 3, 4, 5], fetchNotifications, 2)).toEqual([1, 3, 5]);
    expect(fetchNotifications).toHaveBeenCalledTimes(5);
  });

  it('builds the permission bodies', () => {
    expect(permissionBodies(9, { add: [4], remove: [1] })).toEqual({
      add: [{ deviceId: 4, notificationId: 9 }],
      remove: [{ deviceId: 1, notificationId: 9 }],
    });
  });
});
