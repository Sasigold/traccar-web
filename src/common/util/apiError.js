import { translate } from './translator';

// Errors from the Traccar API and the fleet database, in words the user understands.
//
// An ApiError carries the HTTP status, the database error code and the endpoint. Its message
// starts with one translated line (what happened and what to do); the server's own text, often
// an English Java or PostgREST message, follows on the next lines and is shown only under
// "show details".

const KEYS = {
  network: 'errorNetwork',
  timeout: 'errorTimeout',
  unauthorized: 'errorUnauthorized',
  forbidden: 'errorForbidden',
  notFound: 'errorNotFound',
  duplicate: 'errorDuplicate',
  conflict: 'errorConflict',
  server: 'errorServer',
  general: 'errorRequest',
};

// Errors are created outside React: they read the translation set by LocalizationProvider.
export { setTranslator as setErrorTranslator } from './translator';

export const errorKind = ({ status, code, kind }) => {
  if (kind) {
    return kind;
  }
  if (code === '42501' || status === 403) {
    return 'forbidden';
  }
  if (code === '23505') {
    return 'duplicate';
  }
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 404) {
    return 'notFound';
  }
  if (status === 409) {
    return 'conflict';
  }
  if (status >= 500) {
    return 'server';
  }
  return 'general';
};

// PostgREST and Supabase send JSON ({ code, message, details, hint }); Traccar sends text.
export const parseErrorBody = (text) => {
  if (!text) {
    return { detail: '' };
  }
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object') {
      const detail = [json.message || json.error_description || json.error, json.details, json.hint]
        .filter(Boolean)
        .join('\n');
      return { code: json.code ? String(json.code) : undefined, detail: detail || text };
    }
  } catch {
    // Not JSON: plain text.
  }
  return { detail: text };
};

export class ApiError extends Error {
  constructor({ status, code, endpoint, detail, kind }) {
    const resolved = errorKind({ status, code, kind });
    const technical = [status ? `${status} ${endpoint || ''}`.trim() : endpoint, detail]
      .filter(Boolean)
      .join('\n');
    super(technical ? `${translate(KEYS[resolved])}\n${technical}` : translate(KEYS[resolved]));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
    this.kind = resolved;
    this.detail = detail;
  }
}

export const endpointOf = (input) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  return url.split('?')[0];
};
