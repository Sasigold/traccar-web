// viper fleet official tax documents (BIZ-01): the edge function on the VPS, next to traccar-auth.
// Deploy with deploy/functions.sh. The rules are in core.js and the database; this file connects
// them. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY come from the functions
// container; the provider's keys are read from Vault through billing_provider_credentials().
import { handle } from './core.js';
import { morningClient } from './morning.js';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Not secret: the public address of this function, for the provider's payment notification,
// e.g. https://viper-fleet-api.example.com/functions/v1/billing-documents
const publicUrl =
  Deno.env.get('BILLING_DOCUMENTS_URL') ??
  `${Deno.env.get('API_EXTERNAL_URL') ?? ''}/functions/v1/billing-documents`;

const rest = async (path: string, init: RequestInit = {}, bearer = serviceKey) => {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: bearer === serviceKey ? serviceKey : anonKey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${path}: ${response.status}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const db = {
  isPlatformAdmin: async (jwt: string) => {
    try {
      return (await rest('rpc/is_platform_admin', { method: 'POST', body: '{}' }, jwt)) === true;
    } catch {
      return false;
    }
  },
  claim: (id: string, kind: string) =>
    rest('rpc/billing_document_claim', {
      method: 'POST',
      body: JSON.stringify({ p_invoice: id, p_kind: kind }),
    }),
  credentials: () => rest('rpc/billing_provider_credentials', { method: 'POST', body: '{}' }),
  updateInvoice: (id: string, patch: Record<string, unknown>) =>
    rest(`billing_invoices?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  updateCustomer: (id: string, patch: Record<string, unknown>) =>
    rest(`customers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  loadForNotify: async (id: string) => {
    const [row] = await rest(`billing_invoices?id=eq.${id}&select=*,customer:customers(*)`);
    const [provider] = await rest('billing_provider?select=*');
    return row ? { invoice: row, customer: row.customer, provider } : null;
  },
};

const morningFor = (
  provider: { environment?: string },
  credentials: { id: string; secret: string },
) => morningClient({ fetch, environment: provider?.environment, credentials });

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

Deno.serve((request: Request) => handle(request, { db, morningFor, publicUrl, today }));
