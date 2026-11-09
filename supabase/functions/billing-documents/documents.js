// What we send to the provider for a bill (BIZ-01). Pure, unit-tested.

export const DOCUMENT_TYPES = { invoice: 305, invoiceReceipt: 320, receipt: 400 };

// Our payment methods → Morning payment types (from its "available payment types": 1 cash,
// 2 cheque, 3 credit card, 4 bank transfer). A standing order is a bank debit. Cheques need the
// bank, branch, account and cheque number, which bills do not keep, so they are recorded at the
// provider by hand.
export const PAYMENT_TYPES = { cash: 1, card: 3, transfer: 4, standingOrder: 4 };

export const paymentTypeOf = (method) => PAYMENT_TYPES[method] ?? null;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const clean = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    ),
  );

// The customer as a client at the provider.
export const clientOf = (customer) =>
  clean({
    name: customer.name,
    taxId: customer.company_number ? String(customer.company_number).replace(/\D/g, '') : null,
    emails: [customer.billing_email || customer.email].filter(Boolean),
    phone: customer.phone,
    address: customer.address,
    active: true,
  });

// Lines with a positive amount are income; discount lines (negative) become one discount in
// shekels, since the provider does not take negative VAT on a line. Prices are before VAT.
export const incomeOf = (lines) => {
  const income = lines
    .filter((line) => Number(line.quantity) * Number(line.unit_price) > 0)
    .map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      price: Number(line.unit_price),
      currency: 'ILS',
      vatType: 0,
    }));
  const discount = round2(
    -lines
      .map((line) => round2(Number(line.quantity) * Number(line.unit_price)))
      .filter((amount) => amount < 0)
      .reduce((sum, amount) => sum + amount, 0),
  );
  return { income, discount: discount > 0 ? { type: 'sum', amount: discount } : null };
};

const describe = (invoice) =>
  invoice.period_start && invoice.period_end
    ? `viper fleet ${invoice.period_start} – ${invoice.period_end}`
    : `viper fleet #${invoice.number}`;

// A tax invoice (305), or an invoice-receipt (320) when the bill is already paid.
export const invoiceDocument = ({ invoice, lines, clientId, paymentType }) => {
  const paid = invoice.status === 'paid';
  const { income, discount } = incomeOf(lines);
  return clean({
    type: paid ? DOCUMENT_TYPES.invoiceReceipt : DOCUMENT_TYPES.invoice,
    date: invoice.issue_date,
    dueDate: paid ? null : invoice.due_date,
    lang: 'he',
    currency: 'ILS',
    vatType: 0,
    description: describe(invoice),
    remarks: `#${invoice.number}`,
    signed: true,
    rounding: false,
    client: { id: clientId },
    income,
    discount,
    payment: paid
      ? [
          {
            type: paymentType,
            price: Number(invoice.total),
            currency: 'ILS',
            date: invoice.paid_at,
          },
        ]
      : null,
  });
};

// A receipt (400) for a paid bill whose tax invoice was issued, linked to it.
export const receiptDocument = ({ invoice, clientId, paymentType }) => ({
  type: DOCUMENT_TYPES.receipt,
  date: invoice.paid_at,
  lang: 'he',
  currency: 'ILS',
  vatType: 0,
  description: describe(invoice),
  remarks: `#${invoice.number}`,
  signed: true,
  client: { id: clientId },
  payment: [
    { type: paymentType, price: Number(invoice.total), currency: 'ILS', date: invoice.paid_at },
  ],
  linkedDocumentIds: [invoice.official_id],
});

// The provider's card payment page. After payment it issues the invoice-receipt itself and calls
// notifyUrl; `custom` comes back as external_data.
export const paymentForm = ({ invoice, customer, clientId, maxPayments, notifyUrl, today }) =>
  clean({
    description: describe(invoice),
    type: DOCUMENT_TYPES.invoiceReceipt,
    date: today,
    dueDate: invoice.due_date,
    lang: 'he',
    currency: 'ILS',
    vatType: 0,
    amount: Number(invoice.total),
    maxPayments,
    client: clean({ ...clientOf(customer), id: clientId, active: undefined }),
    notifyUrl,
    custom: invoice.id,
  });

// The provider's total against ours, to the agora.
export const sameAmount = (a, b) =>
  a !== null && a !== undefined && Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
