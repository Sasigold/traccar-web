import { DEFAULT_LIMIT, MAX_LIMIT } from './openapi.js';
import { RESOURCES, resourceOf } from './resources.js';

// AI-07: the public API as an MCP server, so a customer can ask about their fleet from Claude,
// ChatGPT or Copilot. Streamable HTTP without sessions: each POST to /v1/mcp is one JSON-RPC
// message answered with JSON. The tools are the API's resources, read-only, behind the same
// API key and the same database checks (api_authorize, api_v1_rows); nothing here decides what a
// key may see.
//
// Pure: `handleMcp(message, { authorize, rows })` resolves to the JSON-RPC answer (or null for a
// notification). core.js connects it to the request and the database.

export const SERVER_INFO = { name: 'viper-fleet', title: 'viper fleet', version: '1.0.0' };
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS =
  "Read-only access to one organization's fleet data in viper fleet (vehicles, drivers, " +
  'assignments, documents, work orders, issues, inspections, incidents, fuel, expenses, ' +
  'monthly costs, violations and dispatch jobs). Each list_* tool returns a page of rows; pass ' +
  'next_cursor back as cursor for the next page, and updated_since to get only recent changes. ' +
  'Vehicles and drivers are linked by id (vehicle_id, driver_id).';

export const toolName = (resource) => `list_${resource}`;

export const TOOLS = RESOURCES.map((resource) => ({
  name: toolName(resource.name),
  title: resource.en.title,
  description: `${resource.en.description} Fields: ${Object.keys(resource.fields).join(', ')}.`,
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_LIMIT,
        default: DEFAULT_LIMIT,
        description: 'Rows per page.',
      },
      cursor: { type: 'string', description: 'next_cursor from the previous page.' },
      updated_since: {
        type: 'string',
        format: 'date-time',
        description: 'Only rows changed since this ISO 8601 time.',
      },
    },
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
}));

const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// Arguments as the REST query would take them, or an error message.
export const toolArguments = (args = {}) => {
  const params = new URLSearchParams();
  if (args.limit != null) params.set('limit', String(args.limit));
  if (args.cursor != null) params.set('cursor', String(args.cursor));
  if (args.updated_since != null) params.set('updated_since', String(args.updated_since));
  return params;
};

// authorize() → { status, org_id, ... } as api_authorize; rows(resource, params) → { data,
// next_cursor } or { error }.
export const handleMcp = async (message, { authorize, rows }) => {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return fail(message?.id, -32600, 'Invalid request.');
  }
  const { id, method, params = {} } = message;
  const notification = id === undefined;

  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return reply(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null;
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(params.name || '');
      const resource = name.startsWith('list_') ? resourceOf(name.slice(5)) : null;
      if (!resource) {
        return fail(id, -32602, `Unknown tool: ${name}`);
      }
      const auth = await authorize();
      if (Number(auth?.status) !== 200) {
        const text = {
          401: 'A valid API key is required.',
          403: 'This key may not read this.',
          429: `Rate limit exceeded. Retry after ${auth?.retry_after ?? 60} seconds.`,
        }[Number(auth?.status)];
        return reply(id, {
          content: [{ type: 'text', text: text || 'Something went wrong on our side.' }],
          isError: true,
        });
      }
      const page = await rows(resource.name, toolArguments(params.arguments), auth);
      if (page.error) {
        return reply(id, { content: [{ type: 'text', text: page.error }], isError: true });
      }
      const result = { data: page.data, next_cursor: page.next_cursor ?? null };
      return reply(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      });
    }
    default:
      return notification ? null : fail(id, -32601, `Method not found: ${method}`);
  }
};
