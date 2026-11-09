// Morning (Green Invoice) API v1 client for the billing-documents function (BIZ-01).
// Checked against Morning's public Postman collection and JSON schema ("Green Invoice Public API"):
//   POST /account/token {id, secret}  →  {token, expires}  (also in the X-Authorization-Bearer header)
//   POST /clients                     →  the client, with id
//   POST /documents                   →  {id, number, signed, lang, url: {he, en, origin}}
//   GET  /documents/{id}              →  the document: type, number, amount, client, url, …
//   POST /payments/form               →  {errorCode: 0, url}   (needs Morning's Cardcom plugin)
// Errors come back as {errorCode, errorMessage}.

export const MORNING_URLS = {
  production: 'https://api.greeninvoice.co.il/api/v1',
  sandbox: 'https://sandbox.d.greeninvoice.co.il/api/v1',
};

// `definite`: the provider answered and refused, so nothing was created. False when the outcome is
// unknown (no answer, a server error): a document may exist, and retrying could make a second one.
export class ProviderError extends Error {
  constructor(message, { status = 502, code = 'provider_error', definite = true } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
    this.definite = definite;
  }
}

const parseJson = (text) => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

// fetch: the global fetch (injected for tests). credentials: { id, secret }.
export const morningClient = ({ fetch, environment = 'production', credentials }) => {
  const base = MORNING_URLS[environment] ?? MORNING_URLS.production;
  let token = null;

  const parse = async (response) => {
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok || (body && body.errorCode && body.errorCode !== 0)) {
      const message = body?.errorMessage || `HTTP ${response.status}`;
      throw new ProviderError(`Morning: ${message}`, {
        code: response.status === 401 ? 'provider_auth' : 'provider_error',
        // A 4xx is a refusal; a 5xx may come after the document was created.
        definite: response.status < 500,
      });
    }
    return { body, response };
  };

  const authorize = async () => {
    if (token) {
      return token;
    }
    if (!credentials?.id || !credentials?.secret) {
      throw new ProviderError('The Morning API key is not set.', {
        status: 409,
        code: 'provider_keys',
      });
    }
    const { body, response } = await parse(
      await fetch(`${base}/account/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: credentials.id, secret: credentials.secret }),
      }),
    );
    token = body?.token || response.headers.get('X-Authorization-Bearer');
    if (!token) {
      throw new ProviderError('Morning: no token in the answer', { code: 'provider_auth' });
    }
    return token;
  };

  const call = async (method, path, payload) => {
    const bearer = await authorize();
    let response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
    } catch (error) {
      // The request may have reached the provider before the connection dropped.
      throw new ProviderError(`Morning: no answer (${error.message || error})`, {
        code: 'provider_unknown',
        definite: false,
      });
    }
    const { body } = await parse(response);
    return body;
  };

  return {
    addClient: (client) => call('POST', '/clients', client),
    addDocument: (document) => call('POST', '/documents', document),
    getDocument: (id) => call('GET', `/documents/${encodeURIComponent(id)}`),
    paymentForm: (form) => call('POST', '/payments/form', form),
  };
};
