// Data access for the super admin area. Traccar keeps users, devices and the
// links between them; the Viper Fleet database keeps customers, the device
// registry and billing. Every write that changes ownership updates both, so a
// customer's Traccar users always see exactly the customer's devices.
import fetchOrThrow from '../common/util/fetchOrThrow';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { getFreshFleetAccessToken } from '../common/fleet/session';
import { fleetConfig } from '../common/fleet/config';
import { planComputedSync } from './sensors';
import { translate } from '../common/util/translator';

const db = () => getFleetClient();

const json = (body) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const getJson = async (url, signal) => (await fetchOrThrow(url, { signal })).json();

// ─── Traccar ────────────────────────────────────────────────────────────────

// Linking twice is not an error worth showing; Traccar reports it as a
// duplicate key.
const ignoreDuplicate = (error) => {
  if (!/duplicate|unique|already/i.test(error.message)) throw error;
};

export const linkDevice = (userId, deviceId) =>
  fetchOrThrow('api/permissions', { method: 'POST', ...json({ userId, deviceId }) }).catch(
    ignoreDuplicate,
  );

// SEC-06: only a link that is already gone is ignored; any other failure is an error, so a
// customer never keeps a vehicle while the screen says it moved.
const ignoreMissing = (error) => {
  if (error.status !== 404) throw error;
};

export const unlinkDevice = (userId, deviceId) =>
  fetchOrThrow('api/permissions', { method: 'DELETE', ...json({ userId, deviceId }) }).catch(
    ignoreMissing,
  );

// The devices a Traccar user sees, as Traccar answers (direct links and through groups).
const visibleDeviceIds = async (userId) =>
  new Set((await getJson(`api/devices?userId=${userId}`)).map((device) => device.id));

export class AccessMismatchError extends Error {
  constructor(problems) {
    super(
      `${translate('adminAccessMismatch')}\n${problems
        .map(({ userId, deviceId, should }) =>
          translate(should ? 'adminAccessMissing' : 'adminAccessExtra')
            .replace('{0}', userId)
            .replace('{1}', deviceId),
        )
        .join('\n')}`,
    );
    this.name = 'AccessMismatchError';
    this.problems = problems;
  }
}

// Reads back what Traccar shows each user and compares it with what should be:
// expectations = [{ userId, deviceId, should: true | false }].
export const verifyAccess = async (expectations) => {
  const seen = new Map();
  for (const { userId } of expectations) {
    if (!seen.has(userId)) {
      seen.set(userId, await visibleDeviceIds(userId));
    }
  }
  const problems = expectations.filter(
    ({ userId, deviceId, should }) => seen.get(userId).has(deviceId) !== should,
  );
  if (problems.length) {
    throw new AccessMismatchError(problems);
  }
};

export const saveTraccarDevice = async (device) => {
  const response = await fetchOrThrow(device.id ? `api/devices/${device.id}` : 'api/devices', {
    method: device.id ? 'PUT' : 'POST',
    ...json(device),
  });
  return response.json();
};

export const setOdometer = (deviceId, kilometers) =>
  fetchOrThrow(`api/devices/${deviceId}/accumulators`, {
    method: 'PUT',
    ...json({ deviceId, totalDistance: Math.round(kilometers * 1000) }),
  });

export const updateTraccarUser = async (user) =>
  (await fetchOrThrow(`api/users/${user.id}`, { method: 'PUT', ...json(user) })).json();

export const createTraccarUser = async (user) =>
  (await fetchOrThrow('api/users', { method: 'POST', ...json(user) })).json();

// Brings the device's sensor computed attributes in line with `desired`.
export const syncComputedAttributes = async (deviceId, desired) => {
  const linked = await getJson(`api/attributes/computed?deviceId=${deviceId}`);
  const { create, update, remove } = planComputedSync(linked, desired, deviceId);
  await Promise.all(
    update.map((item) =>
      fetchOrThrow(`api/attributes/computed/${item.id}`, { method: 'PUT', ...json(item) }),
    ),
  );
  await Promise.all(
    remove.map((item) => fetchOrThrow(`api/attributes/computed/${item.id}`, { method: 'DELETE' })),
  );
  for (const item of create) {
    const response = await fetchOrThrow('api/attributes/computed', {
      method: 'POST',
      ...json({ priority: 0, ...item }),
    });

    const saved = await response.json();

    await fetchOrThrow('api/permissions', {
      method: 'POST',
      ...json({ deviceId, attributeId: saved.id }),
    });
  }
};

// ─── Viper Fleet database ───────────────────────────────────────────────────

export const loadDirectory = async () => {
  const [customers, registry, customerUsers, counts] = await Promise.all([
    db().from('customers').select('*').order('name'),
    db().from('device_registry').select('*'),
    db().from('customer_users').select('*'),
    db().from('customer_device_counts').select('*'),
  ]).then((results) => results.map(unwrap));
  return { customers, registry, customerUsers, counts };
};

export const loadBilling = async () => {
  const [plans, subscriptions] = await Promise.all([
    db().from('billing_plans').select('*').order('sort_order').order('name'),
    db().from('billing_subscriptions').select('*'),
  ]).then((results) => results.map(unwrap));
  return { plans, subscriptions };
};

export const loadInvoices = async (customerId) => {
  let query = db().from('billing_invoices_view').select('*').order('number', { ascending: false });
  if (customerId) query = query.eq('customer_id', customerId);
  return unwrap(await query);
};

export const loadInvoiceLines = async (invoiceId) =>
  unwrap(
    await db()
      .from('billing_invoice_lines')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order'),
  );

export const saveCustomer = async (customer) => {
  const { id, created_at: createdAt, updated_at: updatedAt, ...fields } = customer;
  void createdAt;
  void updatedAt;
  if (id) {
    return unwrap(await db().from('customers').update(fields).eq('id', id).select().single());
  }
  return unwrap(await db().from('customers').insert(fields).select().single());
};

const customerUserIds = async (customerId) =>
  customerId
    ? unwrap(
        await db().from('customer_users').select('traccar_user_id').eq('customer_id', customerId),
      ).map((row) => row.traccar_user_id)
    : [];

const customerDeviceIds = async (customerId) =>
  unwrap(
    await db().from('device_registry').select('traccar_device_id').eq('customer_id', customerId),
  ).map((row) => row.traccar_device_id);

// Gives devices to a customer (or takes them away with customerId = null):
// registry first, then the Traccar links of the old and new customer's users.
export const assignDevices = async (deviceIds, customerId) => {
  if (!deviceIds.length) return;
  const current = unwrap(
    await db()
      .from('device_registry')
      .select('traccar_device_id, customer_id')
      .in('traccar_device_id', deviceIds),
  );
  const owners = new Map(current.map((row) => [row.traccar_device_id, row.customer_id]));
  unwrap(
    await db()
      .from('device_registry')
      .upsert(
        deviceIds.map((id) => ({ traccar_device_id: id, customer_id: customerId })),
        { onConflict: 'traccar_device_id' },
      ),
  );
  const newUsers = await customerUserIds(customerId);
  const oldCustomers = [...new Set([...owners.values()].filter((id) => id && id !== customerId))];
  const oldUsers = new Map();
  for (const oldCustomer of oldCustomers) {
    oldUsers.set(oldCustomer, await customerUserIds(oldCustomer));
  }
  const tasks = [];
  const expected = [];
  deviceIds.forEach((deviceId) => {
    const previous = owners.get(deviceId);
    if (previous && previous !== customerId) {
      oldUsers.get(previous).forEach((userId) => {
        tasks.push(unlinkDevice(userId, deviceId));
        expected.push({ userId, deviceId, should: false });
      });
    }
    if (previous !== customerId || !owners.has(deviceId)) {
      newUsers.forEach((userId) => tasks.push(linkDevice(userId, deviceId)));
    }
    newUsers.forEach((userId) => expected.push({ userId, deviceId, should: true }));
  });
  await Promise.all(tasks);
  // SEC-06: check what Traccar now shows, so a failed or partial change is reported, not hidden.
  await verifyAccess(expected);
};

export const saveRegistry = async (row) =>
  unwrap(
    await db()
      .from('device_registry')
      .upsert(row, { onConflict: 'traccar_device_id' })
      .select()
      .single(),
  );

// Puts a Traccar user under a customer and links the customer's devices to it.
// A user moving from another customer loses that customer's devices.
export const assignUser = async (userId, customerId, { primary = false } = {}) => {
  const previous = unwrap(
    await db()
      .from('customer_users')
      .select('customer_id')
      .eq('traccar_user_id', userId)
      .maybeSingle(),
  );
  const expected = [];
  if (previous && previous.customer_id !== customerId) {
    const devices = await customerDeviceIds(previous.customer_id);
    await Promise.all(devices.map((deviceId) => unlinkDevice(userId, deviceId)));
    devices.forEach((deviceId) => expected.push({ userId, deviceId, should: false }));
  }
  if (!customerId) {
    unwrap(await db().from('customer_users').delete().eq('traccar_user_id', userId));
    await verifyAccess(expected);
    return;
  }
  unwrap(
    await db()
      .from('customer_users')
      .upsert(
        { traccar_user_id: userId, customer_id: customerId, is_primary: primary },
        { onConflict: 'traccar_user_id' },
      ),
  );
  const devices = await customerDeviceIds(customerId);
  await Promise.all(devices.map((deviceId) => linkDevice(userId, deviceId)));
  devices.forEach((deviceId) => expected.push({ userId, deviceId, should: true }));
  await verifyAccess(expected);
};

// SEC-06: brings every user of a customer in line with the registry: links the customer's
// devices, and removes devices the registry gives to another customer (or to nobody). Devices
// the registry does not know are left alone and reported. Then verifies what Traccar shows.
export const syncCustomerAccess = async (customerId) => {
  const [users, registry] = await Promise.all([
    customerUserIds(customerId),
    db().from('device_registry').select('traccar_device_id, customer_id').then(unwrap),
  ]);
  const owner = new Map(registry.map((row) => [row.traccar_device_id, row.customer_id]));
  const mine = registry
    .filter((row) => row.customer_id === customerId)
    .map((row) => row.traccar_device_id);
  let added = 0;
  let removed = 0;
  const unknown = new Set();
  const expected = [];
  for (const userId of users) {
    const visible = await visibleDeviceIds(userId);
    const tasks = [];
    mine.forEach((deviceId) => {
      if (!visible.has(deviceId)) {
        added += 1;
        tasks.push(linkDevice(userId, deviceId));
      }
      expected.push({ userId, deviceId, should: true });
    });
    visible.forEach((deviceId) => {
      if (!owner.has(deviceId)) {
        unknown.add(deviceId);
      } else if (owner.get(deviceId) !== customerId) {
        removed += 1;
        tasks.push(unlinkDevice(userId, deviceId));
        expected.push({ userId, deviceId, should: false });
      }
    });
    await Promise.all(tasks);
  }
  await verifyAccess(expected);
  return { users: users.length, devices: mine.length, added, removed, unknown: [...unknown] };
};

export const savePlan = async (plan) => {
  const { id, created_at: createdAt, ...fields } = plan;
  void createdAt;
  if (id)
    return unwrap(await db().from('billing_plans').update(fields).eq('id', id).select().single());
  return unwrap(await db().from('billing_plans').insert(fields).select().single());
};

export const deletePlan = async (id) =>
  unwrap(await db().from('billing_plans').delete().eq('id', id));

export const saveSubscription = async (subscription) => {
  const { updated_at: updatedAt, ...fields } = subscription;
  void updatedAt;
  return unwrap(
    await db()
      .from('billing_subscriptions')
      .upsert(fields, { onConflict: 'customer_id' })
      .select()
      .single(),
  );
};

const invoiceFields = (invoice) => {
  const {
    id,
    number,
    subtotal,
    vat_amount: vatAmount,
    total,
    created_at: createdAt,
    updated_at: updatedAt,
    customer_name: customerName,
    is_overdue: isOverdue,
    ...fields
  } = invoice;
  void [id, number, subtotal, vatAmount, total, createdAt, updatedAt, customerName, isOverdue];
  return fields;
};

// Saves a bill with its lines in one transaction (billing_save_invoice, SEC-09). Lines are
// replaced as a whole and only while the bill is a draft; the requested status is set after the
// lines, so a draft can be issued in the same call. The number always comes from the server.
export const saveInvoice = async (invoice, lines) => {
  const fields = invoiceFields(invoice);
  const id = unwrap(
    await db().rpc('billing_save_invoice', {
      p_invoice: { ...fields, ...(invoice.id ? { id: invoice.id } : {}) },
      p_lines: lines
        ? lines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity) || 0,
            unit_price: Number(line.unit_price) || 0,
          }))
        : null,
    }),
  );
  return unwrap(await db().from('billing_invoices_view').select('*').eq('id', id).single());
};

export const setInvoiceStatus = async (id, changes) =>
  unwrap(await db().from('billing_invoices').update(changes).eq('id', id).select().single());

export const deleteInvoice = async (id) =>
  unwrap(await db().from('billing_invoices').delete().eq('id', id));

// ─── official tax documents (BIZ-01) ────────────────────────────────────────

export const loadBillingProvider = async () =>
  unwrap(await db().from('billing_provider').select('*').maybeSingle());

export const saveBillingProvider = async (settings) =>
  unwrap(
    await db()
      .from('billing_provider')
      .upsert({ ...settings, id: true, updated_at: new Date().toISOString() })
      .select()
      .single(),
  );

// Whether the provider's API key id and secret are in Vault (they are never read back).
export const loadBillingKeysStatus = async () =>
  (unwrap(await db().rpc('billing_provider_status')) || [])[0] ?? {
    has_id: false,
    has_secret: false,
  };

export const setBillingSecret = async (name, value) =>
  unwrap(await db().rpc('billing_set_secret', { p_name: name, p_secret: value }));

export class BillingDocumentError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'BillingDocumentError';
    this.code = code;
  }
}

// issue | receipt | payment-link, through the billing-documents edge function.
export const billingDocument = async (action, invoiceId) => {
  const token = await getFreshFleetAccessToken();
  const response = await fetch(`${fleetConfig.url}/functions/v1/billing-documents/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: fleetConfig.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new BillingDocumentError(
      body?.error?.code || `http_${response.status}`,
      body?.error?.message,
    );
  }
  return body;
};

export const loadInvoice = async (id) =>
  unwrap(await db().from('billing_invoices_view').select('*').eq('id', id).single());

// After checking the provider: release a claim that stayed "working" (the edge function stopped).
export const releaseBillingClaim = async (id, kind) =>
  unwrap(
    await db()
      .from('billing_invoices')
      .update(kind === 'receipt' ? { receipt_state: 'failed' } : { official_state: 'failed' })
      .eq('id', id),
  );
