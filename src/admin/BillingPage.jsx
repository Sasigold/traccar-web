import { useMemo, useReducer, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button, Chip, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import { formatTime } from '../common/util/formatter';
import { useAsyncTask, useCatch } from '../reactHelper';
import { messagesActions } from '../store';
import exportExcel from '../common/util/exportExcel';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import KpiTile from './components/KpiTile';
import StateChip from './components/StateChip';
import InvoiceDialog from './components/InvoiceDialog';
import GenerateBillsDialog from './components/GenerateBillsDialog';
import { useAdminAccess, useAdminDirectory } from './useAdmin';
import { loadInvoices } from './adminApi';
import {
  DEFAULT_VAT_RATE,
  addDays,
  formatMoney,
  invoiceState,
  monthlyAmount,
  toIsoDate,
} from './billing';
import { capitalize } from './CustomersPage';

const useStyles = makeStyles()((theme) => ({
  kpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5, 3, 2),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1, 2, 2),
    },
  },
  filters: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  row: {
    cursor: 'pointer',
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}));

const filters = ['all', 'open', 'overdue', 'draft', 'paid', 'cancelled'];

const matches = (filter, state) => {
  if (filter === 'all') return true;
  if (filter === 'open') return state === 'issued' || state === 'overdue';
  return state === filter;
};

// Sum of recurring revenue across active subscriptions.
export const useMonthlyRevenue = (directory) =>
  useMemo(
    () =>
      directory.subscriptions.reduce((sum, subscription) => {
        const customer = directory.customerById.get(subscription.customer_id);
        if (!customer || customer.status === 'archived') return sum;
        const plan = directory.planById.get(subscription.plan_id);
        const billable =
          directory.countByCustomer.get(subscription.customer_id)?.billable_devices || 0;
        return sum + monthlyAmount(subscription, plan, billable);
      }, 0),
    [directory],
  );

export const invoiceSummary = (invoices) => {
  const today = toIsoDate(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  return invoices.reduce(
    (acc, invoice) => {
      const state = invoiceState(invoice, today);
      const total = Number(invoice.total) || 0;
      if (state === 'issued' || state === 'overdue') acc.open += total;
      if (state === 'overdue') {
        acc.overdue += total;
        acc.overdueCount += 1;
      }
      if (state === 'paid' && invoice.paid_at >= monthStart) acc.paidThisMonth += total;
      return acc;
    },
    { open: 0, overdue: 0, overdueCount: 0, paidThisMonth: 0 },
  );
};

const BillingPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { language } = useLocalization();
  const access = useAdminAccess();
  const directory = useAdminDirectory({ billing: true });
  const [reloadKey, reload] = useReducer((value) => value + 1, 0);
  const [invoices, setInvoices] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(null);
  const [generating, setGenerating] = useState(false);

  useAsyncTask(async () => {
    void reloadKey;
    if (access.billingRead) setInvoices(await loadInvoices());
  }, [reloadKey, access.billingRead]);

  const money = (value) => formatMoney(value, language);
  const mrr = useMonthlyRevenue(directory);
  const summary = useMemo(() => invoiceSummary(invoices || []), [invoices]);

  const rows = useMemo(() => {
    if (!invoices) return null;
    const needle = search.trim().toLowerCase();
    return invoices.filter(
      (invoice) =>
        matches(filter, invoiceState(invoice)) &&
        (!needle ||
          invoice.customer_name.toLowerCase().includes(needle) ||
          String(invoice.number).includes(needle)),
    );
  }, [invoices, filter, search]);

  const handleExport = useCatch(async () => {
    const sheet = (rows || []).map((invoice) => ({
      [t('adminInvoiceNumber')]: invoice.number,
      [t('adminCustomer')]: invoice.customer_name,
      [t('adminIssueDate')]: invoice.issue_date,
      [t('adminDueDate')]: invoice.due_date,
      [t('adminPeriodStart')]: invoice.period_start || '',
      [t('adminPeriodEnd')]: invoice.period_end || '',
      [t('adminSubtotal')]: Number(invoice.subtotal),
      [t('adminVatShort')]: Number(invoice.vat_amount),
      [t('adminTotal')]: Number(invoice.total),
      [t('deviceStatus')]: t(`adminInvoiceStatus${capitalize(invoiceState(invoice))}`),
    }));
    if (sheet.length) {
      await exportExcel(
        t('adminInvoices'),
        'bills.xlsx',
        new Map([[t('adminInvoices'), sheet]]),
        theme,
      );
    }
  });

  const newManualInvoice = () => {
    const today = toIsoDate(new Date());
    setDialog({
      invoice: {
        customer_id: null,
        issue_date: today,
        due_date: addDays(today, 30),
        vat_rate: DEFAULT_VAT_RATE,
        status: 'draft',
      },
      lines: [{ description: '', quantity: 1, unit_price: 0 }],
    });
  };

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminInvoices']}
      description={t('adminBillingDescription')}
    >
      <AdminGate need="billingRead" />
      {access.billingRead && (
        <>
          <div className={classes.kpis}>
            <KpiTile
              icon={<AutorenewRoundedIcon />}
              label={t('adminMrr')}
              value={money(mrr)}
              hint={t('adminPerMonthBeforeVat')}
            />
            <KpiTile
              icon={<AccountBalanceWalletRoundedIcon />}
              label={t('adminOpenBalance')}
              value={money(summary.open)}
            />
            <KpiTile
              icon={<WarningAmberRoundedIcon />}
              label={t('adminOverdue')}
              value={money(summary.overdue)}
              hint={t('adminBillsCount').replace('{0}', summary.overdueCount)}
              tone={summary.overdueCount ? 'alert' : 'default'}
            />
            <KpiTile
              icon={<TaskAltRoundedIcon />}
              label={t('adminPaidThisMonth')}
              value={money(summary.paidThisMonth)}
            />
          </div>
          <DataTable
            toolbar={
              <TableToolbar
                search={{ value: search, onChange: setSearch }}
                count={rows?.length}
                exportHandler={handleExport}
                filters={
                  <div className={classes.filters}>
                    {filters.map((key) => (
                      <Chip
                        key={key}
                        size="small"
                        clickable
                        label={t(
                          key === 'all' ? 'fleetFilterAll' : `adminInvoiceFilter${capitalize(key)}`,
                        )}
                        color={filter === key ? 'primary' : 'default'}
                        variant={filter === key ? 'filled' : 'outlined'}
                        onClick={() => setFilter(key)}
                      />
                    ))}
                  </div>
                }
                actions={
                  access.billingManage && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddRoundedIcon />}
                        onClick={newManualInvoice}
                      >
                        {t('adminManualInvoice')}
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<AutorenewRoundedIcon />}
                        onClick={() => setGenerating(true)}
                      >
                        {t('adminGenerateBills')}
                      </Button>
                    </>
                  )
                }
              />
            }
            empty={rows?.length === 0}
            emptyState={{
              icon: <ReceiptLongRoundedIcon />,
              title: t(search ? 'tableNoMatches' : 'adminNoInvoices'),
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('adminInvoiceNumber')}</TableCell>
                <TableCell>{t('adminCustomer')}</TableCell>
                <TableCell>{t('adminPeriod')}</TableCell>
                <TableCell>{t('adminDueDate')}</TableCell>
                <TableCell>{t('adminTotal')}</TableCell>
                <TableCell>{t('deviceStatus')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows ? (
                rows.map((invoice) => {
                  const state = invoiceState(invoice);
                  return (
                    <TableRow
                      key={invoice.id}
                      hover
                      className={classes.row}
                      onClick={() => setDialog({ invoice })}
                    >
                      <TableCell className={classes.number}>
                        <span dir="ltr">{`#${invoice.number}`}</span>
                      </TableCell>
                      <TableCell>{invoice.customer_name}</TableCell>
                      <TableCell className={classes.number}>
                        <span dir="ltr">
                          {invoice.period_start
                            ? `${invoice.period_start} – ${invoice.period_end}`
                            : '–'}
                        </span>
                      </TableCell>
                      <TableCell className={classes.number}>
                        <span dir="ltr">{formatTime(invoice.due_date, 'date')}</span>
                      </TableCell>
                      <TableCell className={classes.number}>{money(invoice.total)}</TableCell>
                      <TableCell>
                        <StateChip
                          state={state}
                          label={t(`adminInvoiceStatus${capitalize(state)}`)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableShimmer columns={6} />
              )}
            </TableBody>
          </DataTable>
        </>
      )}
      {dialog && (
        <InvoiceDialog
          initial={dialog}
          customers={directory.customers}
          readonly={!access.billingManage}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
      {generating && (
        <GenerateBillsDialog
          directory={directory}
          invoices={invoices || []}
          onClose={() => setGenerating(false)}
          onDone={(count) => {
            setGenerating(false);
            dispatch(
              messagesActions.push({
                message: t('adminGenerated').replace('{0}', count),
                severity: 'success',
              }),
            );
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default BillingPage;
