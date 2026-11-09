// viper fleet AI (AI-01, AI-03, AI-04): the edge function on the VPS, next to traccar-auth.
// Deploy with deploy/functions.sh. The rules are in core.js and the database; this file connects
// them. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY come from the functions
// container; the Anthropic key is read from Vault through ai_secret() (set it with
// ai_set_secret, see docs/AI.md). AI_MODEL may name another model; the default is in prompts.js.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { handle } from './core.js';

const url = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const model = Deno.env.get('AI_MODEL') || undefined;

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
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    // PostgREST errors carry the SQL state (42501 switched off, 53400 over the limit).
    throw Object.assign(new Error(body?.message ?? `${path}: ${response.status}`), {
      code: body?.code,
    });
  }
  return body;
};

// The key is read from Vault at most every five minutes.
let cached: { client: Anthropic | null; at: number } = { client: null, at: 0 };
const claude = async () => {
  if (Date.now() - cached.at > 5 * 60 * 1000) {
    const key = await rest('rpc/ai_secret', { method: 'POST', body: '{}' });
    cached = { client: key ? new Anthropic({ apiKey: key }) : null, at: Date.now() };
  }
  return cached.client;
};

const deps = {
  model,
  begin: (jwt: string, kind: string) =>
    rest('rpc/ai_begin', { method: 'POST', body: JSON.stringify({ p_kind: kind }) }, jwt),
  recordTokens: (
    org: string,
    kind: string,
    usage: { input_tokens?: number; output_tokens?: number },
  ) =>
    rest('rpc/ai_record_tokens', {
      method: 'POST',
      body: JSON.stringify({
        p_org: org,
        p_kind: kind,
        p_input: usage?.input_tokens ?? 0,
        p_output: usage?.output_tokens ?? 0,
      }),
    }).catch(() => {}),
  lookupCodes: (codes: string[]) =>
    rest(`dtc_library?code=in.(${codes.map((code) => `"${code}"`).join(',')})&select=*`),
  saveCodes: (rows: unknown[]) =>
    rest('dtc_library', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    }),
};

Deno.serve(async (request: Request) => handle(request, { ...deps, claude: await claude() }));
