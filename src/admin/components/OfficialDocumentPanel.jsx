import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import {
  billingDocument,
  loadBillingProvider,
  loadInvoice,
  releaseBillingClaim,
} from '../adminApi';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.divider}`,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  title: {
    fontWeight: 600,
  },
  url: {
    fontFamily: theme.tokens.font.mono,
    fontSize: 13,
    wordBreak: 'break-all',
  },
}));

const TYPE_KEYS = { 305: 'billingDocTypeInvoice', 320: 'billingDocTypeInvoiceReceipt' };

// The official tax documents of a bill (BIZ-01): the tax invoice or invoice-receipt from the
// provider, with its allocation number on the provider's copy, the receipt, and a card payment
// page. Every action goes through the billing-documents edge function.
const OfficialDocumentPanel = ({ invoice, readonly, onChanged }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [provider, setProvider] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useAsyncTask(async () => {
    try {
      setProvider(await loadBillingProvider());
    } catch {
      setProvider(null);
    }
  }, []);

  if (
    !invoice.id ||
    !['issued', 'paid', 'cancelled'].includes(invoice.status) ||
    provider === undefined
  ) {
    return null;
  }

  const act = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onChanged(await loadInvoice(invoice.id), result);
    } catch (failure) {
      const known = t(`billingDocError_${failure.code}`);
      // The provider's own words help with its errors, and carry the number of a document that
      // was issued but not saved.
      const detail = ['not_recorded', 'provider_error'].includes(failure.code)
        ? failure.message
        : '';
      setError(
        known
          ? `${known} ${detail || ''}`.trim()
          : `${t('billingDocErrorGeneric')} ${failure.message || ''}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const enabled = Boolean(provider?.enabled);
  const canAct = !readonly && enabled && invoice.status !== 'cancelled';
  const working = invoice.official_state === 'working' || invoice.receipt_state === 'working';
  const official = invoice.official_id;

  return (
    <section className={classes.root} aria-label={t('billingDocTitle')}>
      <Typography variant="subtitle2" className={classes.title}>
        {t('billingDocTitle')}
      </Typography>

      {!enabled && !official && (
        <Typography variant="body2" color="textSecondary">
          {t('billingDocProviderOff')}{' '}
          <Link component={RouterLink} to="/admin/invoicing">
            {t('billingDocProviderSettings')}
          </Link>
        </Typography>
      )}

      {official && (
        <div className={classes.row}>
          <Typography variant="body2">
            {t(TYPE_KEYS[invoice.official_type] ?? 'billingDocTypeInvoice')}{' '}
            <span dir="ltr">{invoice.official_number}</span>
          </Typography>
          {invoice.official_url && (
            <Button
              size="small"
              href={invoice.official_url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewRoundedIcon />}
            >
              {t('billingDocOpen')}
            </Button>
          )}
        </div>
      )}
      {invoice.receipt_id && (
        <div className={classes.row}>
          <Typography variant="body2">
            {t('billingDocTypeReceipt')} <span dir="ltr">{invoice.receipt_number}</span>
          </Typography>
          {invoice.receipt_url && (
            <Button
              size="small"
              href={invoice.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewRoundedIcon />}
            >
              {t('billingDocOpen')}
            </Button>
          )}
        </div>
      )}

      {invoice.official_error === 'amount_mismatch' && (
        <Alert severity="warning">
          {t('billingDocMismatch').replace('{0}', invoice.official_amount ?? '')}
        </Alert>
      )}
      {invoice.official_error && invoice.official_error !== 'amount_mismatch' && !working && (
        <Alert severity="error">{`${t('billingDocLastError')} ${invoice.official_error}`}</Alert>
      )}
      {official && invoice.status === 'issued' && (
        <Typography variant="caption" color="textSecondary">
          {t('billingDocLocked')}
        </Typography>
      )}

      {working && (
        <Alert
          severity="info"
          action={
            !readonly && (
              <Button
                size="small"
                disabled={busy}
                onClick={() =>
                  act(() =>
                    releaseBillingClaim(
                      invoice.id,
                      invoice.receipt_state === 'working' ? 'receipt' : 'invoice',
                    ),
                  )
                }
              >
                {t('billingDocRelease')}
              </Button>
            )
          }
        >
          {t('billingDocWorking')}
        </Alert>
      )}

      {invoice.payment_url && !official && (
        <div className={classes.row}>
          <Typography variant="body2">{t('billingDocPaymentLink')}</Typography>
          <Typography className={classes.url} dir="ltr">
            {invoice.payment_url}
          </Typography>
          <Tooltip title={t('sharedCopy')}>
            <IconButton
              size="small"
              aria-label={t('sharedCopy')}
              onClick={() => navigator.clipboard?.writeText(invoice.payment_url)}
            >
              <ContentCopyRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      )}

      {canAct && !working && (
        <div className={classes.row}>
          {!official && (
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => act(() => billingDocument('issue', invoice.id))}
            >
              {t(
                invoice.status === 'paid'
                  ? 'billingDocIssueInvoiceReceipt'
                  : 'billingDocIssueInvoice',
              )}
            </Button>
          )}
          {official &&
            invoice.official_type === 305 &&
            invoice.status === 'paid' &&
            !invoice.receipt_id && (
              <Button
                variant="outlined"
                size="small"
                disabled={busy}
                onClick={() => act(() => billingDocument('receipt', invoice.id))}
              >
                {t('billingDocIssueReceipt')}
              </Button>
            )}
          {!official && invoice.status === 'issued' && provider?.clearing && (
            <Button
              variant="outlined"
              size="small"
              disabled={busy}
              onClick={() => act(() => billingDocument('payment-link', invoice.id))}
            >
              {t(invoice.payment_url ? 'billingDocPaymentLinkAgain' : 'billingDocPaymentLinkMake')}
            </Button>
          )}
        </div>
      )}
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
    </section>
  );
};

export default OfficialDocumentPanel;
