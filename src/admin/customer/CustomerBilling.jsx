import { useState } from 'react';
import {
  Button,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { makeStyles } from 'tss-react/mui';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { formatTime } from '../../common/util/formatter';
import { useAsyncTask, useCatch } from '../../reactHelper';
import FormSection from '../../settings/components/FormSection';
import EmptyState from '../../common/components/table/EmptyState';
import StateChip from '../components/StateChip';
import InvoiceDialog, { paymentMethodKey } from '../components/InvoiceDialog';
import { loadInvoices, saveSubscription } from '../adminApi';
import {
  buildInvoiceDraft,
  cycles,
  effectiveTerms,
  formatMoney,
  invoiceState,
  monthlyAmount,
  paymentMethods,
  periodFor,
  toIsoDate,
} from '../billing';
import { capitalize } from '../CustomersPage';
import { DateField } from '../../common/components/pickers';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  amount: {
    ...theme.typography.h4,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  row: {
    cursor: 'pointer',
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  scroll: {
    overflowX: 'auto',
  },
}));

const blankSubscription = (customerId) => ({
  customer_id: customerId,
  plan_id: null,
  price_per_device: null,
  base_price: null,
  discount_percent: 0,
  cycle: null,
  start_date: toIsoDate(new Date()),
  payment_terms_days: 30,
  payment_method: 'transfer',
  status: 'active',
  notes: '',
});

export const invoiceLabels = (t) => ({
  base: t('adminLineBase'),
  devices: t('adminLineDevices'),
  discount: t('adminLineDiscount'),
});

const CustomerBilling = ({ customer, directory, editable }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const money = (value) => formatMoney(value, language);

  const existing = directory.subscriptionByCustomer.get(customer.id);
  const [form, setForm] = useState(() => existing || blankSubscription(customer.id));
  const [invoices, setInvoices] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    setInvoices(await loadInvoices(customer.id));
  }, [customer.id, reloadKey]);

  const plan = directory.planById.get(form.plan_id);
  const billable = directory.countByCustomer.get(customer.id)?.billable_devices || 0;
  const terms = effectiveTerms(form, plan);
  const monthly = monthlyAmount({ ...form, status: 'active' }, plan, billable);

  const handleSave = useCatch(async () => {
    const toNumberOrNull = (value) =>
      value === '' || value === null || value === undefined ? null : Number(value);
    const saved = await saveSubscription({
      ...form,
      price_per_device: toNumberOrNull(form.price_per_device),
      base_price: toNumberOrNull(form.base_price),
      discount_percent: Number(form.discount_percent) || 0,
      payment_terms_days: Number(form.payment_terms_days) || 0,
      next_billing_date: form.next_billing_date || null,
      cycle: form.cycle || null,
    });
    setForm(saved);
    directory.reload();
  });

  const openNewInvoice = () => {
    const today = new Date();
    setDialog(
      buildInvoiceDraft({
        customerId: customer.id,
        subscription: form,
        plan,
        billableDevices: billable,
        period: periodFor(today, terms.cycle),
        issueDate: toIsoDate(today),
        labels: invoiceLabels(t),
      }),
    );
  };

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const dirty = JSON.stringify(form) !== JSON.stringify(existing || blankSubscription(customer.id));

  return (
    <>
      <FormSection
        icon={<PaymentsRoundedIcon />}
        title={t('adminSubscription')}
        description={t('adminSubscriptionHelp')}
      >
        <div className={classes.grid}>
          <TextField
            select
            className={classes.wide}
            label={t('adminPlan')}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            value={form.plan_id || ''}
            onChange={(event) => setForm({ ...form, plan_id: event.target.value || null })}
            disabled={!editable}
          >
            <MenuItem value="">{t('adminNoPlan')}</MenuItem>
            {directory.plans.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {`${item.name} · ${money(item.price_per_device)} ${t('adminPerDevice')}`}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label={t('adminPricePerDevice')}
            placeholder={plan ? String(plan.price_per_device) : ''}
            helperText={t('adminEmptyUsesPlan')}
            value={form.price_per_device ?? ''}
            onChange={set('price_per_device')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="number"
            label={t('adminBasePrice')}
            placeholder={plan ? String(plan.base_price) : ''}
            helperText={t('adminEmptyUsesPlan')}
            value={form.base_price ?? ''}
            onChange={set('base_price')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="number"
            label={t('adminDiscountPercent')}
            value={form.discount_percent ?? 0}
            onChange={set('discount_percent')}
            disabled={!editable}
          />
          <TextField
            select
            label={t('adminCycle')}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            value={form.cycle || ''}
            onChange={(event) => setForm({ ...form, cycle: event.target.value || null })}
            disabled={!editable}
          >
            <MenuItem value="">
              {`${t('adminFromPlan')}${plan ? ` (${t(`adminCycle${capitalize(plan.cycle)}`)})` : ''}`}
            </MenuItem>
            {cycles.map((cycle) => (
              <MenuItem key={cycle} value={cycle}>
                {t(`adminCycle${capitalize(cycle)}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="number"
            label={t('adminPaymentTerms')}
            value={form.payment_terms_days ?? 30}
            onChange={set('payment_terms_days')}
            disabled={!editable}
          />
          <TextField
            select
            label={t('adminPaymentMethod')}
            value={form.payment_method || ''}
            onChange={set('payment_method')}
            disabled={!editable}
          >
            {paymentMethods.map((method) => (
              <MenuItem key={method} value={method}>
                {t(paymentMethodKey(method))}
              </MenuItem>
            ))}
          </TextField>
          <DateField
            label={t('adminStartDate')}
            value={form.start_date || ''}
            onChange={set('start_date')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <DateField
            label={t('adminNextBilling')}
            value={form.next_billing_date || ''}
            onChange={set('next_billing_date')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label={t('deviceStatus')}
            value={form.status}
            onChange={set('status')}
            disabled={!editable}
          >
            {['active', 'paused', 'cancelled'].map((status) => (
              <MenuItem key={status} value={status}>
                {t(`adminSubscriptionStatus${capitalize(status)}`)}
              </MenuItem>
            ))}
          </TextField>
        </div>
        <div className={classes.summary}>
          <Typography variant="body2">
            {t('adminMonthlyBreakdown')
              .replace('{0}', billable)
              .replace('{1}', money(terms.perDevice))
              .replace('{2}', money(terms.base))
              .replace('{3}', terms.discount)}
          </Typography>
          <span>
            <span className={classes.amount}>{money(monthly)}</span>{' '}
            <Typography component="span" variant="caption">
              {t('adminPerMonthBeforeVat')}
            </Typography>
          </span>
        </div>
        {editable && (
          <div className={classes.actions}>
            <Button variant="contained" onClick={handleSave} disabled={!dirty}>
              {t('adminSaveSubscription')}
            </Button>
          </div>
        )}
      </FormSection>

      <FormSection
        icon={<ReceiptLongRoundedIcon />}
        title={t('adminInvoices')}
        actions={
          editable && (
            <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openNewInvoice}>
              {t('adminNewInvoice')}
            </Button>
          )
        }
      >
        {invoices && invoices.length === 0 && (
          <EmptyState compact icon={<ReceiptLongRoundedIcon />} title={t('adminNoInvoices')} />
        )}
        {invoices && invoices.length > 0 && (
          <div className={classes.scroll}>
            <ResponsiveTable size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('adminInvoiceNumber')}</TableCell>
                  <TableCell>{t('adminPeriod')}</TableCell>
                  <TableCell>{t('adminDueDate')}</TableCell>
                  <TableCell>{t('adminTotal')}</TableCell>
                  <TableCell>{t('deviceStatus')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => {
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
                })}
              </TableBody>
            </ResponsiveTable>
          </div>
        )}
      </FormSection>

      {dialog && (
        <InvoiceDialog
          initial={dialog}
          customers={directory.customers}
          readonly={!editable}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
    </>
  );
};

export default CustomerBilling;
