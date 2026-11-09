// viper fleet public API (INT-01): the edge function on the VPS, next to traccar-auth.
// Deploy: copy this folder to /docker/viper-fleet/volumes/functions/public-api/ (deploy/functions.sh).
// The routing and checks are in core.js; this file only connects it to the database.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set by the Supabase functions container; nothing
// secret is stored in this folder.
import { handle } from './core.js';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Optional, not secret: the public address of the function for links in answers, e.g.
// https://viper-fleet-api.example.com/functions/v1/public-api. Without it the X-Forwarded-* headers
// are used.
const publicUrl = Deno.env.get('PUBLIC_API_URL') ?? null;

// Calls a database function through PostgREST with the service role.
const rpc = async (name: string, args: Record<string, unknown>) => {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey ?? '',
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw new Error(`${name}: ${response.status}`);
  }
  return response.json();
};

Deno.serve((request: Request) => handle(request, { rpc, publicUrl }));
