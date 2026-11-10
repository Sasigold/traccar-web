import { describe, expect, it, vi } from 'vitest';
import { handle } from '../core.js';
import { PROTOCOL_VERSIONS, TOOLS } from '../mcp.js';
import { RESOURCE_NAMES } from '../resources.js';

const KEY = `vf_${'b'.repeat(40)}`;
const ORG = 'a2000000-0000-0000-0000-000000000000';
const URL_MCP = 'https://api.example.com/functions/v1/public-api/v1/mcp';
const okAuth = { status: 200, org_id: ORG, key_id: 'k1', limit: 60, remaining: 58, reset: 1 };

const post = (body, headers = { Authorization: `Bearer ${KEY}` }) =>
  new Request(URL_MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const rpcWith = (auth, page) => vi.fn(async (name) => (name === 'api_authorize' ? auth : page));

describe('the MCP server (AI-07)', () => {
  it('initializes with the protocol the client asks for, when known', async () => {
    const response = await handle(
      post({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't' } },
      }),
      { rpc: rpcWith(okAuth) },
    );
    const body = await response.json();
    expect(body.result.protocolVersion).toBe('2025-03-26');
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe('viper-fleet');

    const newer = await handle(
      post({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: { protocolVersion: '2099-01-01' },
      }),
      { rpc: rpcWith(okAuth) },
    );
    expect((await newer.json()).result.protocolVersion).toBe(PROTOCOL_VERSIONS[0]);
  });

  it('acknowledges notifications without a body', async () => {
    const response = await handle(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), {
      rpc: rpcWith(okAuth),
    });
    expect(response.status).toBe(202);
  });

  it('lists one read-only tool per API resource', async () => {
    const response = await handle(post({ jsonrpc: '2.0', id: 3, method: 'tools/list' }), {
      rpc: rpcWith(okAuth),
    });
    const { tools } = (await response.json()).result;
    expect(tools.map((tool) => tool.name)).toEqual(RESOURCE_NAMES.map((name) => `list_${name}`));
    expect(tools.every((tool) => tool.annotations.readOnlyHint)).toBe(true);
    expect(TOOLS[0].inputSchema.properties.limit.maximum).toBeGreaterThan(1);
  });

  it('calls a tool through the same database checks, scoped to the key', async () => {
    const rpc = rpcWith(okAuth, { data: [{ id: 'v1' }, { id: 'v2' }] });
    const response = await handle(
      post({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'list_vehicles', arguments: { limit: 2 } },
      }),
      { rpc },
    );
    const { result } = await response.json();
    expect(result.structuredContent.data).toHaveLength(2);
    expect(result.structuredContent.next_cursor).toBeTruthy();
    expect(JSON.parse(result.content[0].text).data[0].id).toBe('v1');
    expect(rpc).toHaveBeenCalledWith('api_authorize', { p_key: KEY, p_scope: 'read' });
    expect(rpc).toHaveBeenCalledWith(
      'api_v1_rows',
      expect.objectContaining({ p_org: ORG, p_resource: 'vehicles', p_limit: 2, p_offset: 0 }),
    );
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('58');
  });

  it('answers a bad argument or an unknown tool as errors, not crashes', async () => {
    const bad = await handle(
      post({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'list_vehicles', arguments: { limit: 99999 } },
      }),
      { rpc: rpcWith(okAuth, { data: [] }) },
    );
    expect((await bad.json()).result.isError).toBe(true);
    const unknown = await handle(
      post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'drop_tables' } }),
      { rpc: rpcWith(okAuth) },
    );
    expect((await unknown.json()).error.code).toBe(-32602);
  });

  it('needs a valid key, and says when the key is limited', async () => {
    const missing = await handle(post({ jsonrpc: '2.0', id: 7, method: 'tools/list' }, {}), {
      rpc: rpcWith({ status: 401 }),
    });
    expect(missing.status).toBe(401);
    expect(missing.headers.get('WWW-Authenticate')).toContain('Bearer');
    const limited = await handle(
      post({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'list_drivers' } }),
      { rpc: rpcWith({ status: 429, retry_after: 30 }) },
    );
    const { result } = await limited.json();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('30');
  });

  it('rejects other methods, batches and broken JSON', async () => {
    const get = await handle(new Request(URL_MCP), { rpc: rpcWith(okAuth) });
    expect(get.status).toBe(405);
    const batch = await handle(post([{ jsonrpc: '2.0', id: 1, method: 'ping' }]), {
      rpc: rpcWith(okAuth),
    });
    expect(batch.status).toBe(400);
    const broken = await handle(post('{nope'), { rpc: rpcWith(okAuth) });
    expect((await broken.json()).error.code).toBe(-32700);
  });
});
