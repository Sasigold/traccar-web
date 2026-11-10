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
