import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '../../test/fakeSupabase';

// FND-07: who sees which vehicle. Moving a device or a user between customers changes the fleet
// database and the Traccar links together; a mistake here shows one customer's vehicles to another.
let fake;
vi.mock('../../common/fleet/client', async (original) => ({
  ...(await original()),
  getFleetClient: () => fake.client,
}));

const { assignDevices, assignUser, linkDevice, syncCustomerAccess } = await import('../adminApi');

// Traccar's api/permissions, recorded.
let links;
const permissionsFetch = vi.fn(async (url, init = {}) => {
  const body = JSON.parse(init.body || '{}');
  const key = `${body.userId}:${body.deviceId}`;
  if (init.method === 'POST') {
    if (links.has(key)) {
      return new Response('Duplicate entry', { status: 400 });
    }
    links.add(key);
  } else if (init.method === 'DELETE') {
    links.delete(key);
  }
  return new Response(null, { status: 204 });
});

beforeEach(() => {
  // Customer A (users 11, 12) has devices 1, 2; customer B (user 21) has device 3; device 4 is free.
  fake = createFakeSupabase({
    device_registry: [
      { traccar_device_id: 1, customer_id: 'A' },
      { traccar_device_id: 2, customer_id: 'A' },
      { traccar_device_id: 3, customer_id: 'B' },
      { traccar_device_id: 4, customer_id: null },
    ],
    customer_users: [
      { traccar_user_id: 11, customer_id: 'A', is_primary: true },
      { traccar_user_id: 12, customer_id: 'A', is_primary: false },
      { traccar_user_id: 21, customer_id: 'B', is_primary: true },
    ],
  });
  links = new Set(['11:1', '11:2', '12:1', '12:2', '21:3']);
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('fetch', permissionsFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  permissionsFetch.mockClear();
});

const owner = (deviceId) =>
  fake.data.device_registry.find((row) => row.traccar_device_id === deviceId)?.customer_id;

describe('assignDevices', () => {
  it("moves a device: the old customer's users lose it, the new customer's users get it", async () => {
    await assignDevices([2], 'B');
    expect(owner(2)).toBe('B');
    expect([...links].sort()).toEqual(['11:1', '12:1', '21:2', '21:3']);
  });

  it('takes devices away from a customer', async () => {
    await assignDevices([1, 2], null);
    expect(owner(1)).toBeNull();
    expect([...links]).toEqual(['21:3']);
  });

  it('gives a free device and registers one Traccar knows but the registry does not', async () => {
    await assignDevices([4, 9], 'A');
    expect(owner(4)).toBe('A');
    expect(owner(9)).toBe('A');
    expect([...links]).toEqual(expect.arrayContaining(['11:4', '12:4', '11:9', '12:9']));
  });

  it('does nothing for an empty list', async () => {
    await assignDevices([], 'A');
    expect(permissionsFetch).not.toHaveBeenCalled();
  });
});

describe('assignUser', () => {
  it("moves a user: the old customer's devices go, the new customer's come", async () => {
    await assignUser(12, 'B');
    expect(fake.data.customer_users.find((row) => row.traccar_user_id === 12).customer_id).toBe(
      'B',
    );
    expect([...links].sort()).toEqual(['11:1', '11:2', '12:3', '21:3']);
  });

  it('removes a user from every customer', async () => {
    await assignUser(21, null);
    expect(fake.data.customer_users.some((row) => row.traccar_user_id === 21)).toBe(false);
    expect([...links].some((link) => link.startsWith('21:'))).toBe(false);
  });

  it('adds a new user to a customer as its primary contact', async () => {
    await assignUser(30, 'A', { primary: true });
    expect(fake.data.customer_users.at(-1)).toEqual({
      traccar_user_id: 30,
      customer_id: 'A',
      is_primary: true,
    });
    expect([...links]).toEqual(expect.arrayContaining(['30:1', '30:2']));
  });
});

describe('syncCustomerAccess', () => {
  it('re-creates every missing link of a customer, and ignores links that exist', async () => {
    links.delete('12:2');
    expect(await syncCustomerAccess('A')).toEqual({ users: 2, devices: 2 });
    expect([...links].sort()).toEqual(['11:1', '11:2', '12:1', '12:2', '21:3']);
  });
});

describe('linkDevice', () => {
  it('treats a duplicate link as done, and other errors as errors', async () => {
    await expect(linkDevice(11, 1)).resolves.toBeUndefined();
    permissionsFetch.mockResolvedValueOnce(new Response('Server down', { status: 500 }));
    await expect(linkDevice(11, 7)).rejects.toThrow();
  });
});
