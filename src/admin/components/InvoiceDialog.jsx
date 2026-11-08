import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import CustomerSelect from './CustomerSelect';
import StateChip from './StateChip';
import {
  formatMoney,
  invoiceState,
  invoiceTotals,
  lineAmount,
  paymentMethods,
  toIsoDate,
} from '../billing';
import { deleteInvoice, loadInvoiceLines, saveInvoice, setInvoiceStatus } from '../adminApi';
import { DateField } from '../../common/components/pickers';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  lines: {
    '& .MuiTableCell-root': {
      paddingBlock: theme.spacing(0.75),
      paddingInline: theme.spacing(1),
      borderColor: theme.palette.surface.border,
    },
    '& .MuiTableCell-head': {
      backgroundColor: theme.palette.surface.tint,
      color: theme.palette.surface.textSecondaryOnTint,
      fontWeight: 600,
    },
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  totals: {
    alignSelf: 'flex-end',
    minWidth: 240,
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: theme.spacing(0.5, 3),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  grand: {
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  payment: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  spacer: {
    flex: 1,
  },
}));

export const paymentMethodKey = (method) =>
  `adminPayment${method.charAt(0).toUpperCase()}${method.slice(1)}`;

// One bill. Drafts are fully editable; issued bills only move forward
// (paid / cancelled), so what the customer received never changes.
const InvoiceDialog = ({ initial, customers, readonly, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { language } = useLocalization();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [invoice, setInvoice] = useState(initial.invoice);
  const [lines, setLines] = useState(initial.lines || []);
  const [loaded, setLoaded] = useState(!initial.invoice.id);
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState(() => ({
    paid_at: toIsoDate(new Date()),
    payment_method: initial.invoice.payment_method || 'transfer',
    payment_reference: '',
  }));
  const [busy, setBusy] = useState(false);

  useAsyncTask(async () => {
    if (initial.invoice.id) {
      setLines(await loadInvoiceLines(initial.invoice.id));
      setLoaded(true);
    }
  }, [initial.invoice.id]);

  const editable = !readonly && invoice.status === 'draft';
  const state = invoice.id ? invoiceState(invoice) : 'draft';
  const totals = invoiceTotals(lines, invoice.vat_rate);
  const money = (value) => formatMoney(value, language);
  const valid =
    invoice.customer_id &&
    invoice.issue_date &&
    invoice.due_date &&
    lines.every((line) => line.description?.trim());

  const run = useCatch(async (action) => {
    setBusy(true);
    try {
      const result = await action();
      if (result !== undefined) onSaved(result);
    } finally {
      setBusy(false);
    }
  });

  const save = (status) =>
    run(async () => saveInvoice({ ...invoice, ...(status ? { status } : {}) }, lines));
  const changeStatus = (changes) => run(async () => setInvoiceStatus(invoice.id, changes));
  const remove = () =>
    run(async () => {
      await deleteInvoice(invoice.id);
      return null;
    });

  const set = (key) => (event) => setInvoice({ ...invoice, [key]: event.target.value });
  const setLine = (index, changes) =>
    setLines(lines.map((line, i) => (i === index ? { ...line, ...changes } : line)));

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogTitle>
        <span className={classes.titleRow}>
          <span>
            {invoice.number ? (
              <>
                {`${t('adminInvoice')} `}
                <span dir="ltr">{`#${invoice.number}`}</span>
              </>
            ) : (
              t('adminNewInvoice')
            )}
          </span>
          <StateChip
            state={state}
            label={t(`adminInvoiceStatus${state.charAt(0).toUpperCase()}${state.slice(1)}`)}
          />
        </span>
      </DialogTitle>
      <DialogContent className={classes.content}>
        <div className={classes.grid}>
          <div className={classes.wide}>
            <CustomerSelect
              customers={customers}
              value={invoice.customer_id}
              onChange={(customerId) => setInvoice({ ...invoice, customer_id: customerId })}
              allowEmpty={false}
              disabled={!editable || Boolean(invoice.id)}
            />
          </div>
          <DateField
            label={t('adminIssueDate')}
            value={invoice.issue_date || ''}
            onChange={set('issue_date')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <DateField
            label={t('adminDueDate')}
            value={invoice.due_date || ''}
            min={invoice.issue_date}
            onChange={set('due_date')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="number"
            label={t('adminVatRate')}
            value={invoice.vat_rate ?? ''}
            onChange={(event) =>
              setInvoice({
                ...invoice,
                vat_rate: event.target.value === '' ? 0 : Number(event.target.value),
              })
            }
            disabled={!editable}
          />
          <DateField
            label={t('adminPeriodStart')}
            value={invoice.period_start || ''}
            max={invoice.period_end}
            onChange={set('period_start')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <DateField
            label={t('adminPeriodEnd')}
            value={invoice.period_end || ''}
            min={invoice.period_start}
            onChange={set('period_end')}
            disabled={!editable}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label={t('adminNotes')}
            value={invoice.notes || ''}
            onChange={set('notes')}
            disabled={readonly || state === 'cancelled'}
          />
        </div>

        <Table size="small" className={classes.lines}>
          <TableHead>
            <TableRow>
              <TableCell>{t('adminLineDescription')}</TableCell>
              <TableCell width={110}>{t('adminLineQuantity')}</TableCell>
              <TableCell width={130}>{t('adminLineUnitPrice')}</TableCell>
              <TableCell width={120}>{t('adminLineAmount')}</TableCell>
              {editable && <TableCell padding="none" width={40} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {loaded &&
              lines.map((line, index) => (
                <TableRow key={line.id || `new-${index}`}>
                  <TableCell>
                    {editable ? (
                      <TextField
                        size="small"
                        fullWidth
                        value={line.description}
                        onChange={(event) => setLine(index, { description: event.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': t('adminLineDescription') } }}
                      />
                    ) : (
                      line.description
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>
                    {editable ? (
                      <TextField
                        size="small"
                        type="number"
                        value={line.quantity}
                        onChange={(event) => setLine(index, { quantity: event.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': t('adminLineQuantity') } }}
                      />
                    ) : (
                      Number(line.quantity)
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>
                    {editable ? (
                      <TextField
                        size="small"
                        type="number"
                        value={line.unit_price}
                        onChange={(event) => setLine(index, { unit_price: event.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': t('adminLineUnitPrice') } }}
                      />
                    ) : (
                      money(line.unit_price)
                    )}
                  </TableCell>
                  <TableCell className={classes.number}>{money(lineAmount(line))}</TableCell>
                  {editable && (
                    <TableCell padding="none">
                      <Tooltip title={t('sharedRemove')}>
                        <IconButton
                          size="small"
                          aria-label={t('sharedRemove')}
                          onClick={() => setLines(lines.filter((_, i) => i !== index))}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {editable && (
          <div>
            <Button
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={() => setLines([...lines, { description: '', quantity: 1, unit_price: 0 }])}
            >
              {t('adminAddLine')}
            </Button>
          </div>
        )}

        <div className={classes.totals}>
          <span>{t('adminSubtotal')}</span>
          <span className={classes.number}>{money(totals.subtotal)}</span>
          <span>{t('adminVat').replace('{0}', invoice.vat_rate ?? 0)}</span>
          <span className={classes.number}>{money(totals.vat)}</span>
          <span className={classes.grand}>{t('adminTotal')}</span>
          <span className={`${classes.number} ${classes.grand}`}>{money(totals.total)}</span>
        </div>

        {invoice.status === 'paid' && (
          <Alert severity="success">
            {t('adminPaidOn')
              .replace('{0}', invoice.paid_at || '')
              .replace(
                '{1}',
                invoice.payment_method ? t(paymentMethodKey(invoice.payment_method)) : '',
              )}
            {invoice.payment_reference ? ` · ${invoice.payment_reference}` : ''}
          </Alert>
        )}

        {paying && (
          <div className={classes.payment}>
            <DateField
              label={t('adminPaidAt')}
              value={payment.paid_at}
              onChange={(event) => setPayment({ ...payment, paid_at: event.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              select
              label={t('adminPaymentMethod')}
              value={payment.payment_method}
              onChange={(event) => setPayment({ ...payment, payment_method: event.target.value })}
            >
              {paymentMethods.map((method) => (
                <MenuItem key={method} value={method}>
                  {t(paymentMethodKey(method))}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('adminPaymentReference')}
              value={payment.payment_reference}
              onChange={(event) =>
                setPayment({ ...payment, payment_reference: event.target.value })
              }
            />
          </div>
        )}
        <Typography variant="caption" color="textSecondary">
          {t('adminInvoiceDisclaimer')}
        </Typography>
      </DialogContent>
      <DialogActions>
        {!readonly && invoice.id && invoice.status === 'draft' && (
          <Button color="error" onClick={remove} disabled={busy}>
            {t('sharedRemove')}
          </Button>
        )}
        {!readonly && invoice.status === 'issued' && !paying && (
          <Button
            color="error"
            onClick={() => changeStatus({ status: 'cancelled' })}
            disabled={busy}
          >
            {t('adminCancelInvoice')}
          </Button>
        )}
        <span className={classes.spacer} />
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {t('adminClose')}
        </Button>
        {editable && (
          <>
            <Button variant="outlined" onClick={() => save()} disabled={busy || !valid}>
              {t('adminSaveDraft')}
            </Button>
            <Button
              variant="contained"
              onClick={() => save('issued')}
              disabled={busy || !valid || !lines.length}
            >
              {t('adminIssueInvoice')}
            </Button>
          </>
        )}
        {!readonly && invoice.status === 'issued' && !paying && (
          <>
            <Button
              variant="outlined"
              onClick={() => run(async () => saveInvoice(invoice))}
              disabled={busy}
            >
              {t('sharedSave')}
            </Button>
            <Button variant="contained" onClick={() => setPaying(true)} disabled={busy}>
              {t('adminMarkPaid')}
            </Button>
          </>
        )}
        {paying && (
          <Button
            variant="contained"
            onClick={() => changeStatus({ status: 'paid', ...payment })}
            disabled={busy || !payment.paid_at}
          >
            {t('adminConfirmPayment')}
          </Button>
        )}
        {!readonly && invoice.status === 'paid' && (
          <Button onClick={() => changeStatus({ status: 'issued' })} disabled={busy}>
            {t('adminUndoPayment')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceDialog;
