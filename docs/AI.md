# AI in viper fleet (AI-01 to AI-04)

The model is called only by the `fleet-ai` edge function (`supabase/functions/fleet-ai`). The
browser never sees the key; every call carries the user's fleet token, and the database decides
whether the user's organization may call it.

## Turning it on (owner)

1. Run the migrations (`sh deploy/migrate.sh`): `20261115100000_fleet_ai.sql` adds the switch,
   the daily limit, the usage counter and the fault-code library.
2. Deploy the function: `sh deploy/functions.sh` (it now copies `fleet-ai` too).
3. Put the Anthropic API key in Vault, signed in as a platform administrator:
   `select public.ai_set_secret('sk-ant-...');` (from the SQL editor, or through the RPC).
   Never put the key in a table, an environment file or git.
4. Optional: `AI_MODEL` in the functions container picks another model. The default is
   `claude-opus-5-5` with low effort; declined requests fall back on the server
   (`fallbacks: "default"`).

Until the key is set, the app says "AI is not connected on the server yet".

## Per organization

- `ai_settings.enabled` switches the AI off for an organization (users with `users.manage`).
- `ai_settings.daily_limit` (default 200) counts model calls per day, Israel time. A question
  that needs data takes a few calls (one per tool round).
- `ai_usage` keeps requests and tokens per day and kind (`ask`, `dtc`, `extract`, `insights`).
- `ai_status()` returns on/off, the limit, today's use and whether a key is set.

## What each feature sends

| Feature | Route | Sent to the model |
|---|---|---|
| Fleet questions (AI-01) | `POST /ask` | The question and the results of the fixed tools the model asked for; the tools run in the browser with the user's permissions. No free SQL. |
| Fault codes (AI-03) | `POST /dtc` | Only codes missing from `dtc_library`; the answer is kept in the library for everyone. |
| Document scanning (AI-04) | `POST /extract` | The photo or PDF the user chose. Nothing is saved until the user confirms the form. |

Privacy: questions and documents can contain personal data (drivers' names, ID numbers, licenses).
List the model provider as a processor in the processing register (`PrivacyPage`) and have the
lawyer review it with the rest of SEC-12.
