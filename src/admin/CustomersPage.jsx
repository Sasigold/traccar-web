import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import StateChip from './components/StateChip';
import { useAdminAccess, useAdminDirectory } from './useAdmin';
import { formatMoney, monthlyAmount } from './billing';

const useStyles = makeStyles()((theme) => ({
  row: {
    cursor: 'pointer',
  },
  name: {
    fontWeight: 600,
  },
  sub: {
    display: 'block',
    color: theme.palette.text.secondary,
  },
  filters: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
  },
}));

export const customerStatuses = ['active', 'trial', 'suspended', 'archived'];

export const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const CustomersPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const navigate = useNavigate();
  const access = useAdminAccess();
  const directory = useAdminDirectory({ billing: true });

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('current');

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return directory.customers.filter((customer) => {
      if (status === 'current' && customer.status === 'archived') return false;
      if (status !== 'current' && status !== 'all' && customer.status !== status) return false;
      if (!needle) return true;
      return [
        customer.name,
        customer.company_number,
        customer.contact_name,
        customer.email,
        customer.phone,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [directory.customers, search, status]);

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminCustomers']}
      description={t('adminCustomersDescription')}
    >
      <AdminGate need="customersRead" />
      {access.customersRead && (
        <DataTable
          toolbar={
            <TableToolbar
              search={{ value: search, onChange: setSearch }}
              count={rows.length}
              addPath={access.customersManage ? '/admin/customer' : undefined}
              addLabel={t('adminNewCustomer')}
              filters={
                <div className={classes.filters}>
                  {['current', ...customerStatuses, 'all'].map((key) => (
                    <Chip
                      key={key}
                      size="small"
                      clickable
                      label={t(
                        key === 'all' ? 'fleetFilterAll' : `adminCustomerStatus${capitalize(key)}`,
                      )}
                      color={status === key ? 'primary' : 'default'}
                      variant={status === key ? 'filled' : 'outlined'}
                      onClick={() => setStatus(key)}
                    />
                  ))}
                </div>
              }
            />
          }
          empty={directory.loaded && rows.length === 0}
          emptyState={{
            icon: <StoreRoundedIcon />,
            title: t(search ? 'tableNoMatches' : 'adminNoCustomersYet'),
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('adminCustomer')}</TableCell>
              <TableCell>{t('adminContact')}</TableCell>
              <TableCell>{t('adminDevices')}</TableCell>
              {access.billingRead && <TableCell>{t('adminMonthly')}</TableCell>}
              <TableCell>{t('deviceStatus')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {directory.loaded ? (
              rows.map((customer) => {
                const counts = directory.countByCustomer.get(customer.id);
                const subscription = directory.subscriptionByCustomer.get(customer.id);
                const plan = subscription ? directory.planById.get(subscription.plan_id) : null;
                return (
                  <TableRow
                    key={customer.id}
                    hover
                    className={classes.row}
                    onClick={() => navigate(`/admin/customer/${customer.id}`)}
                  >
                    <TableCell>
                      <span className={classes.name}>{customer.name}</span>
                      {customer.company_number && (
                        <Typography variant="caption" className={classes.sub}>
                          {`${t('adminCompanyNumber')} ${customer.company_number}`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.contact_name}
                      {customer.phone && (
                        <Typography
                          variant="caption"
                          className={classes.sub}
                          dir="ltr"
                          style={{ textAlign: 'start' }}
                        >
                          {customer.phone}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell className={classes.number}>{counts?.devices ?? 0}</TableCell>
                    {access.billingRead && (
                      <TableCell className={classes.number}>
                        {subscription
                          ? formatMoney(
                              monthlyAmount(subscription, plan, counts?.billable_devices || 0),
                              language,
                            )
                          : '–'}
                      </TableCell>
                    )}
                    <TableCell>
                      <StateChip
                        state={customer.status}
                        label={t(`adminCustomerStatus${capitalize(customer.status)}`)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableShimmer columns={access.billingRead ? 5 : 4} />
            )}
          </TableBody>
        </DataTable>
      )}
    </PageLayout>
  );
};

export default CustomersPage;
