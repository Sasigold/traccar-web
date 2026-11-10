import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Link, List, ListItem, Typography } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { checkInvoice, overchargeTotal } from '../../common/fleet/invoiceCheck';
import { money } from '../fleetData';

// ISR-13: the work order's lines against the supplier's agreed prices, and its invoice number
// against the other orders. Shown under the lines while they are edited; says nothing when there
// is no price list and nothing to report.
const InvoiceCheckPanel = ({ order, items }) => {
  const t = useTranslation();
  const [context, setContext] = useState(null);

  useAsyncTask(async () => {
    const client = getFleetClient();
    const [prices, others] = await Promise.all([
      client.from('vendor_prices').select('*').then(unwrap),
      order.invoice_number
        ? client
            .from('work_orders')
            .select('id, number, vendor_id, invoice_number')
            .eq('invoice_number', order.invoice_number)
            .then(unwrap)
        : [],
    ]);
    setContext({ prices: prices || [], others: others || [] });
  }, [order.invoice_number]);

  if (!context) return null;
  const lines = items.filter((item) => item.description?.trim());
  const findings = checkInvoice({ order, items: lines, ...context });
  if (!findings.length) {
    return context.prices.length && lines.length ? (
      <Alert severity="success">{t('invoiceCheckOk')}</Alert>
    ) : null;
  }
  const overcharge = overchargeTotal(findings);
  const severity = findings.some((f) => f.type !== 'noAgreement') ? 'warning' : 'info';

  return (
    <Alert severity={severity} role="status">
      <Typography variant="body2" fontWeight={600}>
        {overcharge > 0
          ? t('invoiceCheckOvercharge').replace('{0}', money(overcharge))
          : t('invoiceCheckTitle')}
      </Typography>
      <List dense disablePadding>
        {findings.map((finding, index) => (
          <ListItem key={index} disableGutters sx={{ display: 'list-item' }}>
            {finding.type === 'overPrice' &&
              t('invoiceCheckOverPrice')
                .replace('{0}', finding.item.description)
                .replace('{1}', money(finding.item.unit_price))
                .replace('{2}', money(finding.agreed.unit_price))}
            {finding.type === 'duplicateLine' &&
              t('invoiceCheckDuplicateLine').replace('{0}', finding.item.description)}
            {finding.type === 'noAgreement' &&
              t('invoiceCheckNoAgreement').replace('{0}', finding.item.description)}
            {finding.type === 'duplicateInvoice' && (
              <>
                {t('invoiceCheckDuplicateInvoice')}{' '}
                <Link component={RouterLink} to={`/fleet/work-order/${finding.orderId}`}>
                  #{finding.number}
                </Link>
              </>
            )}
          </ListItem>
        ))}
      </List>
    </Alert>
  );
};

export default InvoiceCheckPanel;
