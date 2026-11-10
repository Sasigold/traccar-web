import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Link, List, ListItem, Typography } from '@mui/material';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { checkInvoice, overchargeTotal } from '../../common/fleet/invoiceCheck';
import { money } from '../fleetData';
import { formatTime } from '../../common/util/formatter';

// ISR-13: the work order's lines against the supplier's agreed prices, and its invoice number
// against the other orders. Shown under the lines while they are edited; says nothing when there
// is no price list and nothing to report.
// AI-08: also against what other fleets pay (the market median) and the vehicle's warranty.
const InvoiceCheckPanel = ({ order, items, device }) => {
  const t = useTranslation();
  const [context, setContext] = useState(null);

  // The lines' descriptions, as one value the task follows.
  const lineKey = [...new Set(items.map((item) => item.description?.trim()).filter(Boolean))].join(
    '\n',
  );

  useAsyncTask(async () => {
    const client = getFleetClient();
    const descriptions = lineKey ? lineKey.split('\n') : [];
    const [prices, others, market] = await Promise.all([
      client.from('vendor_prices').select('*').then(unwrap),
      order.invoice_number
        ? client
            .from('work_orders')
            .select('id, number, vendor_id, invoice_number')
            .eq('invoice_number', order.invoice_number)
            .then(unwrap)
        : [],
      // AI-08: what other fleets pay; nothing when this fleet has not joined the comparison.
      descriptions.length
        ? client
            .rpc('market_prices', { p_descriptions: descriptions })
            .then(unwrap)
            .catch(() => [])
        : [],
    ]);
    setContext({
      prices: prices || [],
      others: others || [],
      market: Object.fromEntries((market || []).map((row) => [row.description, row])),
    });
  }, [order.invoice_number, lineKey]);

  if (!context) return null;
  const lines = items.filter((item) => item.description?.trim());
  const attributes = device?.attributes || {};
  const warranty = attributes.warrantyUntil
    ? { until: attributes.warrantyUntil, km: attributes.warrantyKm }
    : null;
  const findings = checkInvoice({ order, items: lines, ...context, warranty });
  if (!findings.length) {
    return (context.prices.length || Object.keys(context.market).length) && lines.length ? (
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
            {finding.type === 'aboveMarket' &&
              t('invoiceCheckAboveMarket')
                .replace('{0}', finding.item.description)
                .replace('{1}', money(finding.item.unit_price))
                .replace('{2}', money(finding.median))
                .replace('{3}', String(finding.fleets))}
            {finding.type === 'warranty' &&
              t('invoiceCheckWarranty').replace('{0}', formatTime(finding.until, 'date'))}
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
