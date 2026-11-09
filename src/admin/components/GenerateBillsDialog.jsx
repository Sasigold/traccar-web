import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import ResponsiveTable from '../../common/components/table/ResponsiveTable';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { saveInvoice } from '../adminApi';
import { buildInvoiceDraft, formatMoney, invoiceTotals, periodFor, toIsoDate } from '../billing';
import { invoiceLabels } from '../customer/CustomerBilling';
import { keepOnBackdrop } from '../../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
  controls: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  muted: {
    color: theme.palette.text.secondary,
  },
  total: {
    alignSelf: 'flex-end',
    fontWeight: 700,
  },
}));

const monthValue = (date) => toIsoDate(date).slice(0, 7);

// Creates one bill per active subscription for the chosen month, skipping
// customers that already have a bill for that period.
const GenerateBillsDialog = ({ directory, invoices, onClose, onDone }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [issue, setIssue] = useState(true);
  const [excluded, setExcluded] = useState([]);
  const [busy, setBusy] = useState(false);

  const [issueDate] = useState(() => toIsoDate(new Date()));

  const candidates = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    const anchor = new Date(year, (monthNumber || 1) - 1, 1);
    return directory.subscriptions
      .filter((subscription) => subscription.status === 'active')
      .map((subscription) => {
        const customer = directory.customerById.get(subscription.customer_id);
        if (!customer || customer.status === 'archived') return null;
        const plan = directory.planById.get(subscription.plan_id);
        const cycle = subscription.cycle || plan?.cycle || 'monthly';
        const period = periodFor(anchor, cycle);
        const billable = directory.countByCustomer.get(customer.id)?.billable_devices || 0;
        const draft = buildInvoiceDraft({
          customerId: customer.id,
          subscription,
          plan,
          billableDevices: billable,
          period,
          issueDate,
          labels: invoiceLabels(t),
        });
        const billed = invoices.some(
          (invoice) =>
            invoice.customer_id === customer.id &&
            invoice.period_start === period.start &&
            invoice.status !== 'cancelled',
        );
        return { customer, billable, period, draft, billed, totals: invoiceTotals(draft.lines) };
      })
      .filter(Boolean)
      .sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }, [month, directory, invoices, issueDate, t]);

  const selected = candidates.filter(
    (item) => !item.billed && item.draft.lines.length > 0 && !excluded.includes(item.customer.id),
  );
  const sum = selected.reduce((total, item) => total + item.totals.total, 0);

  const handleGenerate = useCatch(async () => {
    setBusy(true);
    try {
      for (const item of selected) {
        await saveInvoice(
          { ...item.draft.invoice, status: issue ? 'issued' : 'draft' },
          item.draft.lines,
        );
      }
      onDone(selected.length);
    } finally {
      setBusy(false);
    }
  });

  const toggle = (id) =>
    setExcluded((current) =>
      current.includes(id) ? current.filter((it) => it !== id) : [...current, id],
    );

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>{t('adminGenerateBills')}</DialogTitle>
      <DialogContent className={classes.content}>
        <Typography variant="body2" color="textSecondary">
          {t('adminGenerateBillsHelp')}
        </Typography>
        <div className={classes.controls}>
          <TextField
            type="month"
            label={t('adminBillingMonth')}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel
            control={
              <Switch checked={issue} onChange={(event) => setIssue(event.target.checked)} />
            }
            label={t('adminIssueImmediately')}
          />
        </div>
        <ResponsiveTable size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>{t('adminCustomer')}</TableCell>
              <TableCell>{t('adminPeriod')}</TableCell>
              <TableCell>{t('adminBillableShort')}</TableCell>
              <TableCell>{t('adminTotal')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {candidates.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className={classes.muted}>
                  {t('adminNoActiveSubscriptions')}
                </TableCell>
              </TableRow>
            )}
            {candidates.map((item) => {
              const disabled = item.billed || item.draft.lines.length === 0;
              return (
                <TableRow key={item.customer.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      disabled={disabled}
                      checked={!disabled && !excluded.includes(item.customer.id)}
                      onChange={() => toggle(item.customer.id)}
                      slotProps={{ input: { 'aria-label': item.customer.name } }}
                    />
                  </TableCell>
                  <TableCell>
                    {item.customer.name}
                    {item.billed && (
                      <Typography
                        variant="caption"
                        className={classes.muted}
                        style={{ display: 'block' }}
                      >
                        {t('adminAlreadyBilled')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>
                    <span dir="ltr">{`${item.period.start} – ${item.period.end}`}</span>
                  </TableCell>
                  <TableCell className={classes.number}>{item.billable}</TableCell>
                  <TableCell className={classes.number}>
                    {formatMoney(item.totals.total, language)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </ResponsiveTable>
        <Typography variant="body2" className={classes.total}>
          {t('adminGenerateSummary')
            .replace('{0}', selected.length)
            .replace('{1}', formatMoney(sum, language))}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {t('sharedCancel')}
        </Button>
        <Button variant="contained" onClick={handleGenerate} disabled={busy || !selected.length}>
          {t('adminGenerate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GenerateBillsDialog;
