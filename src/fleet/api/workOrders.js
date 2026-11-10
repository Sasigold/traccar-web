import { unwrap } from '../../common/fleet/client';

// ARC-10: the work order's reads, out of the page (the pure rules are in
// common/fleet/workOrders.js). `client` is the fleet client.

// The order with its vehicle's Traccar id, and its lines in order.
export const loadWorkOrder = async (client, id) => {
  const [order, items] = await Promise.all([
    client.from('work_orders').select('*, vehicles(traccar_device_id)').eq('id', id).single(),
    client.from('work_order_items').select('*').eq('work_order_id', id).order('sort_order'),
  ]);
  return { order: unwrap(order), items: unwrap(items) || [] };
};

// ADM-19: the faults a new order is opened for (?issue=<id>), with their vehicle.
export const loadIssues = async (client, ids) =>
  ids.length
    ? unwrap(
        await client
          .from('issues')
          .select('id, title, description, status, vehicles(traccar_device_id)')
          .in('id', ids),
      ) || []
    : [];

// The order's faults that are still open (they close with it).
export const openIssuesOf = async (client, orderId) =>
  unwrap(
    await client
      .from('issues')
      .select('id, title')
      .eq('work_order_id', orderId)
      .in('status', ['open', 'in_progress']),
  ) || [];

// The faults are now handled by the order.
export const linkIssues = async (client, orderId, ids) => {
  if (!ids.length) return;
  unwrap(
    await client
      .from('issues')
      .update({ work_order_id: orderId, status: 'in_progress' })
      .in('id', ids),
  );
};
