// Data access for the super admin area. Traccar keeps users, devices and the
// links between them; the Viper Fleet database keeps customers, the device
// registry and billing. Every write that changes ownership updates both, so a
// customer's Traccar users always see exactly the customer's devices.
import fetchOrThrow from '../common/util/fetchOrThrow';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { planComputedSync } from './sensors';

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

export const unlinkDevice = (userId, deviceId) =>
  fetchOrThrow('api/permissions', { method: 'DELETE', ...json({ userId, deviceId }) }).catch(
    () => null,
  );

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
  deviceIds.forEach((deviceId) => {
    const previous = owners.get(deviceId);
    if (previous && previous !== customerId) {
      oldUsers.get(previous).forEach((userId) => tasks.push(unlinkDevice(userId, deviceId)));
    }
    if (previous !== customerId || !owners.has(deviceId)) {
      newUsers.forEach((userId) => tasks.push(linkDevice(userId, deviceId)));
    }
  });
  await Promise.all(tasks);
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
  if (previous && previous.customer_id !== customerId) {
    const devices = await customerDeviceIds(previous.customer_id);
    await Promise.all(devices.map((deviceId) => unlinkDevice(userId, deviceId)));
  }
  if (!customerId) {
    unwrap(await db().from('customer_users').delete().eq('traccar_user_id', userId));
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
};

// Re-creates every Traccar link of a customer (users × devices).
export const syncCustomerAccess = async (customerId) => {
  const [users, devices] = await Promise.all([
    customerUserIds(customerId),
    customerDeviceIds(customerId),
  ]);
  await Promise.all(
    users.flatMap((userId) => devices.map((deviceId) => linkDevice(userId, deviceId))),
  );
  return { users: users.length, devices: devices.length };
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

// Saves a bill with its lines. Lines are replaced as a whole and only while
// the bill is a draft; issued bills change status only.
export const saveInvoice = async (invoice, lines) => {
  const fields = invoiceFields(invoice);
  const saved = invoice.id
    ? unwrap(
        await db().from('billing_invoices').update(fields).eq('id', invoice.id).select().single(),
      )
    : unwrap(await db().from('billing_invoices').insert(fields).select().single());
  if (lines) {
    unwrap(await db().from('billing_invoice_lines').delete().eq('invoice_id', saved.id));
    if (lines.length) {
      unwrap(
        await db()
          .from('billing_invoice_lines')
          .insert(
            lines.map((line, index) => ({
              invoice_id: saved.id,
              description: line.description,
              quantity: Number(line.quantity) || 0,
              unit_price: Number(line.unit_price) || 0,
              sort_order: index,
            })),
          ),
      );
    }
  }
  return unwrap(await db().from('billing_invoices_view').select('*').eq('id', saved.id).single());
};

export const setInvoiceStatus = async (id, changes) =>
  unwrap(await db().from('billing_invoices').update(changes).eq('id', id).select().single());

export const deleteInvoice = async (id) =>
  unwrap(await db().from('billing_invoices').delete().eq('id', id));
