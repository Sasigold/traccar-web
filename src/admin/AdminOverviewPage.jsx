import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import PageLayout from '../common/components/PageLayout';
import EmptyState from '../common/components/table/EmptyState';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import KpiTile from '../common/components/KpiTile';
import { useAdminAccess, useAdminDirectory, useTraccarList } from './useAdmin';
import { loadInvoices } from './adminApi';
import { formatMoney, invoiceState } from './billing';
import { invoiceSummary, useMonthlyRevenue } from './BillingPage';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(0.5, 3, 4),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    maxWidth: 1240,
    width: '100%',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1, 2, 3),
    },
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing(1.5),
  },
  panels: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  panel: {
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1.75, 2.25, 1),
  },
  panelTitle: {
    fontWeight: 700,
  },
  item: {
    paddingInline: theme.spacing(2.25),
  },
  secondary: {
    color: theme.palette.text.secondary,
  },
}));

const STALE_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 6;

const Panel = ({ title, link, linkLabel, children }) => {
  const { classes } = useStyles();
  return (
    <Paper elevation={0} className={classes.panel}>
      <div className={classes.panelHead}>
        <Typography variant="subtitle1" className={classes.panelTitle}>
          {title}
        </Typography>
        {link && (
          <Button size="small" component={RouterLink} to={link}>
            {linkLabel}
          </Button>
        )}
      </div>
      {children}
    </Paper>
  );
};

const AdminOverviewPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { language } = useLocalization();
  const access = useAdminAccess();
  const directory = useAdminDirectory({ billing: true });
  const [devices] = useTraccarList('api/devices?all=true');
  const [users] = useTraccarList('api/users');
  const [invoices, setInvoices] = useState([]);
  const [now] = useState(() => Date.now());

  useAsyncTask(async () => {
    if (access.billingRead) setInvoices(await loadInvoices());
  }, [access.billingRead]);

  const money = (value) => formatMoney(value, language);
  const mrr = useMonthlyRevenue(directory);
  const summary = useMemo(() => invoiceSummary(invoices), [invoices]);

  const stats = useMemo(() => {
    const list = devices || [];
    const unassigned = list.filter((device) => !directory.deviceOwner.get(device.id)?.customer_id);
    const stale = list
      .filter(
        (device) =>
          !device.disabled &&
          (!device.lastUpdate || now - new Date(device.lastUpdate).getTime() > STALE_MS),
      )
      .sort((a, b) => (a.lastUpdate || '').localeCompare(b.lastUpdate || ''));
    return {
      total: list.length,
      online: list.filter((device) => device.status === 'online').length,
      unassigned,
      stale,
    };
  }, [devices, directory.deviceOwner, now]);

  const activeCustomers = directory.customers.filter(
    (customer) => customer.status === 'active' || customer.status === 'trial',
  ).length;
  const overdue = invoices.filter((invoice) => invoiceState(invoice) === 'overdue');

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminOverview']}
      title={t('adminTitle')}
      description={t('adminOverviewDescription')}
      actions={
        <div className={classes.actions}>
          {access.customersManage && (
            <Button
              variant="outlined"
              startIcon={<StoreRoundedIcon />}
              onClick={() => navigate('/admin/customer')}
            >
              {t('adminNewCustomer')}
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate('/admin/device')}
          >
            {t('adminNewDevice')}
          </Button>
        </div>
      }
    >
      <AdminGate need="customersRead" />
      <div className={classes.root}>
        <div className={classes.kpis}>
          <KpiTile
            icon={<DnsRoundedIcon />}
            label={t('adminDevices')}
            value={devices ? stats.total : '–'}
            hint={t('adminOnlineCount').replace('{0}', stats.online)}
            to="/admin/devices"
          />
          {access.customersRead && (
            <>
              <KpiTile
                icon={<StoreRoundedIcon />}
                label={t('adminActiveCustomers')}
                value={directory.loaded ? activeCustomers : '–'}
                to="/admin/customers"
              />
              <KpiTile
                icon={<LinkOffRoundedIcon />}
                label={t('adminUnassignedDevices')}
                value={devices && directory.loaded ? stats.unassigned.length : '–'}
                tone={stats.unassigned.length ? 'alert' : 'default'}
                to="/admin/devices"
              />
            </>
          )}
          <KpiTile
            icon={<PeopleRoundedIcon />}
            label={t('adminUsers')}
            value={users ? users.filter((user) => !user.temporary).length : '–'}
            to="/admin/users"
          />
          {access.billingRead && (
            <>
              <KpiTile
                icon={<AutorenewRoundedIcon />}
                label={t('adminMrr')}
                value={money(mrr)}
                hint={t('adminPerMonthBeforeVat')}
                to="/admin/billing"
              />
              <KpiTile
                icon={<AccountBalanceWalletRoundedIcon />}
                label={t('adminOpenBalance')}
                value={money(summary.open)}
                to="/admin/billing"
              />
              <KpiTile
                icon={<WarningAmberRoundedIcon />}
                label={t('adminOverdue')}
                value={money(summary.overdue)}
                hint={t('adminBillsCount').replace('{0}', summary.overdueCount)}
                tone={summary.overdueCount ? 'alert' : 'default'}
                to="/admin/billing"
              />
            </>
          )}
        </div>

        <div className={classes.panels}>
          {access.customersRead && (
            <Panel
              title={t('adminWaitingForCustomer')}
              link="/admin/devices"
              linkLabel={t('adminShowAll')}
            >
              {stats.unassigned.length === 0 ? (
                <EmptyState compact icon={<LinkOffRoundedIcon />} title={t('adminAllAssigned')} />
              ) : (
                <List dense disablePadding>
                  {stats.unassigned.slice(0, LIST_LIMIT).map((device) => (
                    <ListItemButton
                      key={device.id}
                      className={classes.item}
                      onClick={() => navigate(`/admin/device/${device.id}`)}
                    >
                      <ListItemText
                        primary={device.name}
                        secondary={<span dir="ltr">{device.uniqueId}</span>}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Panel>
          )}
          <Panel
            title={t('adminSilentDevices')}
            link="/admin/devices"
            linkLabel={t('adminShowAll')}
          >
            {stats.stale.length === 0 ? (
              <EmptyState compact icon={<SensorsRoundedIcon />} title={t('adminAllReporting')} />
            ) : (
              <List dense disablePadding>
                {stats.stale.slice(0, LIST_LIMIT).map((device) => (
                  <ListItemButton
                    key={device.id}
                    className={classes.item}
                    onClick={() => navigate(`/admin/device/${device.id}`)}
                  >
                    <ListItemText
                      primary={device.name}
                      secondary={
                        device.lastUpdate ? (
                          <span dir="ltr">{formatTime(device.lastUpdate, 'minutes')}</span>
                        ) : (
                          t('adminNeverReported')
                        )
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Panel>
          {access.billingRead && (
            <Panel
              title={t('adminOverdueBills')}
              link="/admin/billing"
              linkLabel={t('adminShowAll')}
            >
              {overdue.length === 0 ? (
                <EmptyState
                  compact
                  icon={<AccountBalanceWalletRoundedIcon />}
                  title={t('adminNoOverdue')}
                />
              ) : (
                <List dense disablePadding>
                  {overdue.slice(0, LIST_LIMIT).map((invoice) => (
                    <ListItemButton
                      key={invoice.id}
                      className={classes.item}
                      onClick={() => navigate(`/admin/customer/${invoice.customer_id}?tab=billing`)}
                    >
                      <ListItemText
                        primary={invoice.customer_name}
                        secondary={
                          <>
                            <span dir="ltr">{`#${invoice.number} · ${formatTime(invoice.due_date, 'date')}`}</span>
                            {` · ${money(invoice.total)}`}
                          </>
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Panel>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminOverviewPage;
