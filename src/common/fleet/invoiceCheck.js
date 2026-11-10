// ISR-13: a supplier's invoice (a work order's lines) against the agreed price list: a price
// above the agreement, the same line twice, an invoice number already billed, and lines with no
// agreed price. Pure, tested. What was billed but not done needs a person; the check says what
// to look at.

// Descriptions compared without case, punctuation, quotes or extra spaces (Hebrew included).
export const normalizeItem = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/["'״׳`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// The agreed price for a line: same vendor first, then any vendor; an exact description first,
// then one contained in the other (e.g. "החלפת שמן" in "החלפת שמן מנוע 5W30"); valid on the date.
/**
 * @param {any} item
 * @param {any[]} prices
 * @param {{ vendorId?: string, date?: string }} [options]
 */
export const agreedPrice = (item, prices, options = {}) => {
  const { vendorId, date } = options;
  const name = normalizeItem(item.description);
  if (!name) return null;
  const day = date ? String(date).slice(0, 10) : null;
  const valid = prices.filter(
    (price) =>
      (!price.vendor_id || price.vendor_id === vendorId) &&
      (!price.kind || !item.kind || price.kind === item.kind) &&
      (!day || !price.valid_from || price.valid_from <= day) &&
      (!day || !price.valid_to || price.valid_to >= day),
  );
  const rank = (price) => {
    const agreed = normalizeItem(price.description);
    const exact = agreed === name;
    const contains =
      !exact && agreed.length >= 4 && (name.includes(agreed) || agreed.includes(name));
    if (!exact && !contains) return 0;
    return (price.vendor_id ? 2 : 0) + (exact ? 1 : 0) + 1;
  };
  return (
    valid
      .map((price) => ({ price, score: rank(price) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.price ?? null
  );
};

// Findings: [{ type, item?, agreed?, over?, overAmount?, orderId? }]. type is overPrice,
// duplicateLine, duplicateInvoice or noAgreement. others: the organization's other work orders
// ({ id, vendor_id, invoice_number }).
export const checkInvoice = ({ order, items, prices = [], others = [] }) => {
  const findings = [];
  const date = order?.closed_at || order?.opened_at;
  items.forEach((item) => {
    if (!normalizeItem(item.description)) return;
    const agreed = agreedPrice(item, prices, { vendorId: order?.vendor_id, date });
    if (!agreed) {
      if (prices.length) findings.push({ type: 'noAgreement', item });
      return;
    }
    const limit = Number(agreed.unit_price) * (1 + (Number(agreed.tolerance_pct) || 0) / 100);
    if (Number(item.unit_price) > limit + 0.005) {
      const over = Number(item.unit_price) - Number(agreed.unit_price);
      findings.push({
        type: 'overPrice',
        item,
        agreed,
        over,
        overAmount: Math.round(over * (Number(item.quantity) || 1) * 100) / 100,
      });
    }
  });
  const seen = new Map();
  items.forEach((item) => {
    const key = `${normalizeItem(item.description)}|${Number(item.unit_price)}`;
    if (!normalizeItem(item.description)) return;
    if (seen.has(key)) findings.push({ type: 'duplicateLine', item });
    else seen.set(key, item);
  });
  const number = String(order?.invoice_number || '').trim();
  if (number) {
    const twice = others.find(
      (other) =>
        other.id !== order.id &&
        String(other.invoice_number || '').trim() === number &&
        (!order.vendor_id || !other.vendor_id || other.vendor_id === order.vendor_id),
    );
    if (twice) findings.push({ type: 'duplicateInvoice', orderId: twice.id, number: twice.number });
  }
  return findings;
};

// What the overcharges add up to.
export const overchargeTotal = (findings) =>
  Math.round(
    findings
      .filter((finding) => finding.type === 'overPrice')
      .reduce((sum, finding) => sum + finding.overAmount, 0) * 100,
  ) / 100;
