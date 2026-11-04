import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Skeleton, Tab, Tabs } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../common/components/LocalizationProvider';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
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
  const [tab, setTab] = useState('details');

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
              editable={access.customersManage}
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
