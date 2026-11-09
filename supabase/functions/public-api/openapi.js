import { RESOURCES } from './resources.js';

// The OpenAPI 3.0 document of the public API, in Hebrew or English (INT-01). Pure.

export const API_VERSION = 'v1';
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 1000;
export const DEFAULT_RATE = { perMinute: 60, perDay: 20000 };

const TEXT = {
  he: {
    title: 'viper fleet API',
    description: [
      'גישה לקריאה בלבד לנתוני הצי של הארגון, לחיבור ל-Power BI, ל-Excel ולמערכות אחרות.',
      '',
      '**הזדהות.** כל בקשה נושאת מפתח API בכותרת `X-API-Key` (או `Authorization: Bearer`). את המפתחות יוצרים במסך "אינטגרציות".',
      '',
      `**מגבלת קצב.** לפי החבילה של הארגון, ברירת המחדל ${DEFAULT_RATE.perMinute} בקשות בדקה ו-${DEFAULT_RATE.perDay.toLocaleString('en-US')} ביום. הכותרות \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` ו-\`X-RateLimit-Reset\` מראות מה נשאר. מעבר למגבלה מחזיר 429 עם \`Retry-After\`.`,
      '',
      `**עמודים.** עד ${MAX_LIMIT} שורות בעמוד (ברירת מחדל ${DEFAULT_LIMIT}). התשובה כוללת \`next\`, הכתובת של העמוד הבא, או null בסוף.`,
      '',
      '**רענון מצטבר.** `updated_since` מחזיר רק שורות שהשתנו מאז. כל שורה כוללת `changed_at`.',
    ].join('\n'),
    limit: 'כמה שורות בעמוד',
    cursor: 'המשך מהעמוד הקודם (מתוך `next_cursor`)',
    since: 'רק שורות שהשתנו מהזמן הזה (ISO 8601)',
    page: 'עמוד של שורות',
    nextCursor: 'הסמן לעמוד הבא, או null',
    next: 'הכתובת המלאה של העמוד הבא, או null',
    changedAt: 'מתי השורה השתנתה לאחרונה (או נוצרה)',
    errors: {
      400: 'פרמטר לא תקין',
      401: 'אין מפתח, או שהמפתח לא תקין, בוטל או פג',
      403: 'למפתח אין הרשאה לפעולה הזו',
      429: 'עברתם את מגבלת הקצב; נסו שוב אחרי Retry-After שניות',
    },
  },
  en: {
    title: 'viper fleet API',
    description: [
      "Read-only access to the organization's fleet data, for Power BI, Excel and other systems.",
      '',
      '**Authentication.** Every request carries an API key in the `X-API-Key` header (or `Authorization: Bearer`). Keys are created on the Integrations screen.',
      '',
      `**Rate limit.** Set by the organization's package; by default ${DEFAULT_RATE.perMinute} requests a minute and ${DEFAULT_RATE.perDay.toLocaleString('en-US')} a day. The \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\` and \`X-RateLimit-Reset\` headers show what is left. Going over returns 429 with \`Retry-After\`.`,
      '',
      `**Paging.** Up to ${MAX_LIMIT} rows a page (${DEFAULT_LIMIT} by default). The answer has \`next\`, the address of the next page, or null at the end.`,
      '',
      '**Incremental refresh.** `updated_since` returns only rows changed since then. Every row has `changed_at`.',
    ].join('\n'),
    limit: 'Rows per page',
    cursor: 'Continue from the previous page (its `next_cursor`)',
    since: 'Only rows changed at or after this time (ISO 8601)',
    page: 'A page of rows',
    nextCursor: 'The cursor of the next page, or null',
    next: 'The full address of the next page, or null',
    changedAt: 'When the row last changed (or was created)',
    errors: {
      400: 'An invalid parameter',
      401: 'No key, or the key is invalid, revoked or expired',
      403: 'The key may not do this',
      429: 'Over the rate limit; retry after Retry-After seconds',
    },
  },
};

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: { code: { type: 'string' }, message: { type: 'string' } },
      required: ['code', 'message'],
    },
  },
};

// serverUrl: the base the paths hang from, e.g. https://host/functions/v1/public-api/v1
export const buildOpenApi = ({ lang = 'en', serverUrl = `/${API_VERSION}` } = {}) => {
  const text = TEXT[lang] ?? TEXT.en;
  const errorResponse = (code) => ({
    description: text.errors[code],
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  });
  const rateHeaders = {
    'X-RateLimit-Limit': { schema: { type: 'integer' } },
    'X-RateLimit-Remaining': { schema: { type: 'integer' } },
    'X-RateLimit-Reset': { schema: { type: 'integer' } },
  };
  const schemaName = (name) =>
    name.replace(/(^|_)(\w)/g, (_, __, letter) => letter.toUpperCase()).replace(/s$/, '');

  const schemas = { Error: errorSchema };
  const paths = {};
  RESOURCES.forEach((resource) => {
    const local = resource[lang] ?? resource.en;
    const name = schemaName(resource.name);
    schemas[name] = {
      type: 'object',
      description: local.description,
      additionalProperties: true,
      properties: {
        ...resource.fields,
        changed_at: { type: 'string', format: 'date-time', description: text.changedAt },
      },
    };
    paths[`/${resource.name}`] = {
      get: {
        operationId: `list_${resource.name}`,
        summary: local.title,
        description: local.description,
        tags: [local.title],
        parameters: [
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/cursor' },
          { $ref: '#/components/parameters/updated_since' },
        ],
        responses: {
          200: {
            description: text.page,
            headers: rateHeaders,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'next_cursor', 'next'],
                  properties: {
                    data: { type: 'array', items: { $ref: `#/components/schemas/${name}` } },
                    next_cursor: { type: 'string', nullable: true, description: text.nextCursor },
                    next: { type: 'string', nullable: true, description: text.next },
                  },
                },
              },
            },
          },
          400: errorResponse(400),
          401: errorResponse(401),
          403: errorResponse(403),
          429: {
            ...errorResponse(429),
            headers: { ...rateHeaders, 'Retry-After': { schema: { type: 'integer' } } },
          },
        },
      },
    };
  });

  return {
    openapi: '3.0.3',
    info: { title: text.title, version: '1.0.0', description: text.description },
    servers: [{ url: serverUrl }],
    security: [{ apiKey: [] }, { bearer: [] }],
    paths,
    components: {
      securitySchemes: {
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        bearer: { type: 'http', scheme: 'bearer' },
      },
      parameters: {
        limit: {
          name: 'limit',
          in: 'query',
          description: text.limit,
          schema: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT },
        },
        cursor: {
          name: 'cursor',
          in: 'query',
          description: text.cursor,
          schema: { type: 'string' },
        },
        updated_since: {
          name: 'updated_since',
          in: 'query',
          description: text.since,
          schema: { type: 'string', format: 'date-time' },
        },
      },
      schemas,
    },
  };
};
