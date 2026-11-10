import { useCallback, useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAsyncTask } from '../reactHelper';
import { getJson, loadBilling, loadDirectory } from './adminApi';

const hasKey = (permissions, key) => permissions.includes(key) || permissions.includes('*');

// Who may do what in the super admin area. Traccar administrators see the
// area; the database permissions decide which customer and billing parts work.
export const useAdminAccess = () => {
  const admin = useSelector((state) => Boolean(state.session.user?.administrator));
  const status = useSelector((state) => state.fleet.status);
  const permissions = useSelector((state) => state.fleet.permissions);
  return useMemo(() => {
    const ready = status === 'ready';
    const can = (key) => ready && hasKey(permissions, key);
    return {
      admin,
      fleetStatus: status,
      fleetReady: ready,
      customersRead: can('customers.read') || can('customers.manage'),
      customersManage: can('customers.manage'),
      billingRead: can('billing.read') || can('billing.manage'),
      billingManage: can('billing.manage'),
    };
  }, [admin, status, permissions]);
};

// Moved to common/fleet (ADM-21); kept here for the admin screens that import it.
export { default as useFleetReconnect } from '../common/fleet/useFleetReconnect';

const emptyDirectory = { customers: [], registry: [], customerUsers: [], counts: [] };
const emptyBilling = { plans: [], subscriptions: [] };

// Customers, the device registry, customer users and (optionally) billing,
// with lookup maps (customerById, deviceOwner, userCustomer, countByCustomer,
// planById, subscriptionByCustomer). `reload()` fetches everything again after a change.
export const useAdminDirectory = ({ billing = false } = {}) => {
  const access = useAdminAccess();
  const [reloadKey, reload] = useReducer((value) => value + 1, 0);
  const [directory, setDirectory] = useState(emptyDirectory);
  const [billingData, setBillingData] = useState(emptyBilling);
  const [loaded, setLoaded] = useState(false);

  const wantBilling = billing && access.billingRead;

  useAsyncTask(async () => {
    void reloadKey;
    if (!access.customersRead) {
      setLoaded(true);
      return;
    }
    const [nextDirectory, nextBilling] = await Promise.all([
      loadDirectory(),
      wantBilling ? loadBilling() : Promise.resolve(emptyBilling),
    ]);
    setDirectory(nextDirectory);
    setBillingData(nextBilling);
    setLoaded(true);
  }, [reloadKey, access.customersRead, wantBilling]);

  const maps = useMemo(() => {
    return {
      customerById: new Map(directory.customers.map((row) => [row.id, row])),
      deviceOwner: new Map(directory.registry.map((row) => [row.traccar_device_id, row])),
      userCustomer: new Map(directory.customerUsers.map((row) => [row.traccar_user_id, row])),
      countByCustomer: new Map(directory.counts.map((row) => [row.customer_id, row])),
      planById: new Map(billingData.plans.map((row) => [row.id, row])),
      subscriptionByCustomer: new Map(
        billingData.subscriptions.map((row) => [row.customer_id, row]),
      ),
    };
  }, [directory, billingData]);

  return { ...directory, ...billingData, ...maps, loaded, reload };
};

// A Traccar collection loaded once (with reload), e.g. api/devices?all=true.
export const useTraccarList = (url) => {
  const [items, setItems] = useState(null);
  const [reloadKey, reload] = useReducer((value) => value + 1, 0);
  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      setItems(await getJson(url, signal));
    },
    [url, reloadKey],
  );
  const refresh = useCallback(() => reload(), []);
  return [items, refresh];
};
