// Roadmap stage 2: work order helpers (pure, unit-tested).

export const WORK_ORDER_STATUSES = ['planned', 'open', 'in_shop', 'done', 'cancelled'];
export const WORK_ORDER_TYPES = [
  'service',
  'repair',
  'tires',
  'inspection',
  'recall',
  'body',
  'other',
];
export const ITEM_KINDS = ['part', 'labor', 'fee'];

const round = (value) => Math.round(value * 100) / 100;

export const itemTotal = (item) =>
  round((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));

export const itemsTotal = (items) => round(items.reduce((sum, item) => sum + itemTotal(item), 0));

// Timestamps that go with a status change: entering the shop and closing are recorded once.
export const statusChange = (order, status, now = new Date()) => {
  const changes = { status };
  if (status === 'in_shop' && !order.in_shop_at) {
    changes.in_shop_at = now.toISOString();
  }
  if (status === 'done' || status === 'cancelled') {
    changes.closed_at = order.closed_at || now.toISOString();
  } else {
    changes.closed_at = null;
  }
  return changes;
};

export const isOpenStatus = (status) => status !== 'done' && status !== 'cancelled';

// Odometer in km from the latest Traccar position (totalDistance is in meters).
export const odometerKm = (position) => {
  const meters = position?.attributes?.totalDistance ?? position?.attributes?.odometer;
  return typeof meters === 'number' ? Math.round(meters / 1000) : null;
};
