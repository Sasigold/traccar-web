import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Skeleton, Tab, Tabs } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import { useDispatch } from 'react-redux';
import { useConfirm } from '../common/components/confirm/ConfirmProvider';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { messagesActions } from '../store';
import CustomerDetails from './customer/CustomerDetails';
import CustomerDevices from './customer/CustomerDevices';
import CustomerUsers from './customer/CustomerUsers';
import CustomerBilling from './customer/CustomerBilling';
import { useAdminAccess, useAdminDirectory, useTraccarList } from './useAdmin';

const useStyles = makeStyles()((theme) => ({
  tabs: {
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    marginBottom: theme.spacing(0.5),
  },
}));

const newCustomer = { name: '', status: 'active' };

const CustomerPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const access = useAdminAccess();
  const directory = useAdminDirectory({ billing: true });
  const [devices] = useTraccarList('api/devices?all=true');
  const [users, reloadUsers] = useTraccarList('api/users');
  // ADM-26: the tab is in the address, so a link (an overdue account) opens on it.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'details';
  const setTab = (value) =>
    setSearchParams(value === 'details' ? {} : { tab: value }, { replace: true });
  const confirm = useConfirm();
  const dispatch = useDispatch();

  // ADM-26: a suspended customer's users can be disabled in the same step.
  const suspendUsers = useCatch(async (saved) => {
    const linked = directory.customerUsers
      .filter((row) => row.customer_id === saved.id)
      .map((row) => (users || []).find((user) => user.id === row.traccar_user_id))
      .filter((user) => user && !user.disabled && !user.administrator);
    if (
      !linked.length ||
      !(await confirm({
        title: t('adminSuspendUsersTitle'),
        message: t('adminSuspendUsers').replace('{0}', String(linked.length)),
        confirmLabel: t('adminSuspendUsersConfirm'),
      }))
    ) {
      return;
    }
    for (const user of linked) {
      const latest = await (await fetchOrThrow(`api/users/${user.id}`)).json();
      await fetchOrThrow(`api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, disabled: true }),
      });
    }
    reloadUsers();
    dispatch(
      messagesActions.push({
        message: t('adminSuspendUsersDone').replace('{0}', String(linked.length)),
        severity: 'success',
      }),
    );
  });

  const customer = id ? directory.customerById.get(id) : newCustomer;
  const loading = id && !directory.loaded;

  return (
    <FormPage
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminCustomers']}
      title={id ? customer?.name || t('adminCustomer') : t('adminNewCustomer')}
      backTo="/admin/customers"
      maxWidth={920}
    >
      <AdminGate need="customersRead" className="" />
      {loading && (
        <FormSection title={<Skeleton width="10em" />}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={-i} variant="rounded" height={40} />
          ))}
        </FormSection>
      )}
      {!loading && customer && (
        <>
          {id && (
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              className={classes.tabs}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab value="details" label={t('adminCustomerDetails')} />
              <Tab value="devices" label={t('adminDevices')} />
              <Tab value="users" label={t('adminUsers')} />
              {access.billingRead && <Tab value="billing" label={t('adminGroupBilling')} />}
            </Tabs>
          )}
          {tab === 'details' && (
            <CustomerDetails
              key={`${customer.id || 'new'}-${customer.updated_at || ''}`}
              customer={customer}
              customers={directory.customers}
              editable={access.customersManage}
              onSuspended={suspendUsers}
              onSaved={(saved) => {
                directory.reload();
                if (!id) navigate(`/admin/customer/${saved.id}`, { replace: true });
              }}
            />
          )}
          {tab === 'devices' && (
            <CustomerDevices
              customer={customer}
              devices={devices}
              directory={directory}
              editable={access.customersManage}
            />
          )}
          {tab === 'users' && (
            <CustomerUsers
              customer={customer}
              users={users}
              directory={directory}
              editable={access.customersManage}
              onUsersChanged={reloadUsers}
            />
          )}
          {tab === 'billing' && access.billingRead && (
            <CustomerBilling
              customer={customer}
              directory={directory}
              editable={access.billingManage}
            />
          )}
        </>
      )}
    </FormPage>
  );
};

export default CustomerPage;
