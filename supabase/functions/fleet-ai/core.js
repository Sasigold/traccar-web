import {
  ASK_SYSTEM,
  ASK_TOOLS,
  ASK_TOOL_NAMES,
  COURSE_SCHEMA,
  COURSE_SYSTEM,
  DTC_SCHEMA,
  DTC_SYSTEM,
  EXTRACT_KINDS,
  MODEL,
  extractSchema,
  extractSystem,
} from './prompts.js';

// The fleet-ai edge function (AI-01, AI-03, AI-04), without Deno: handle(request, deps).
//
//   POST /ask      {messages}            one model turn of a fleet question; the browser runs
//                                        the tools the model asks for and sends their results
//   POST /dtc      {codes}               fault codes explained (library first, then the model)
//   POST /extract  {kind, media_type, data}  fields read from a photo of a document
//   POST /course   {media_type, data}    a short Hebrew course and quiz from a procedure (AI-10)
//
// Every call needs the user's fleet JWT; deps.begin(jwt, kind) checks the organization's switch
// and daily limit in the database and returns the organization. deps: { begin, recordTokens,
// claude (an Anthropic client), model, lookupCodes(codes), saveCodes(rows) }.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS,
    },
  });

export const fail = (status, code, message = code) => json(status, { error: { code, message } });

export class AiError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const MAX_TURNS = 40;
const MAX_TEXT = 4000;
const MAX_IMAGE = 7 * 1024 * 1024; // base64 characters
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const CODE = /^[PBCU][0-9A-F]{4}$/;

// Calls go to the beta endpoint for server-side fallbacks: a declined request is retried on
// another model inside the same call.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };

const textOf = (message) =>
  message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

const checkStop = (message) => {
  if (message.stop_reason === 'refusal') {
    throw new AiError(422, 'refused', 'The model declined this request.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new AiError(502, 'truncated', 'The answer was cut off.');
  }
};

// The conversation of /ask comes from the browser: only user and assistant turns, only the block
// types a fleet question uses, tool results only for the fixed tools, and no system text.
export const validateMessages = (messages) => {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_TURNS) {
    throw new AiError(400, 'invalid_messages');
  }
  const asked = new Map();
  messages.forEach((message, index) => {
    if (!message || !['user', 'assistant'].includes(message.role)) {
      throw new AiError(400, 'invalid_messages');
    }
    if (index === 0 && message.role !== 'user') {
      throw new AiError(400, 'invalid_messages');
    }
    const blocks =
      typeof message.content === 'string'
        ? [{ type: 'text', text: message.content }]
        : message.content;
    if (!Array.isArray(blocks) || !blocks.length) {
      throw new AiError(400, 'invalid_messages');
    }
    blocks.forEach((block) => {
      const type = block?.type;
      if (type === 'text') {
        if (typeof block.text !== 'string' || block.text.length > MAX_TEXT * 4) {
          throw new AiError(400, 'invalid_messages');
        }
      } else if (type === 'tool_use' && message.role === 'assistant') {
        if (!ASK_TOOL_NAMES.includes(block.name)) throw new AiError(400, 'invalid_messages');
        asked.set(block.id, block.name);
      } else if (type === 'tool_result' && message.role === 'user') {
        if (!asked.has(block.tool_use_id)) throw new AiError(400, 'invalid_messages');
      } else if (type === 'thinking' && message.role === 'assistant') {
        // Passed back unchanged, as the API expects.
      } else if (type === 'fallback' && message.role === 'assistant') {
        // The record of a server-side fallback; passed back unchanged.
      } else {
        throw new AiError(400, 'invalid_messages');
      }
    });
  });
  const last = messages[messages.length - 1];
  if (last.role !== 'user') {
    throw new AiError(400, 'invalid_messages');
  }
  const question = typeof last.content === 'string' ? last.content : null;
  if (question && question.length > MAX_TEXT) {
    throw new AiError(400, 'question_too_long');
  }
  return messages;
};

const ask = async (body, deps, org) => {
  const messages = validateMessages(body.messages);
  const message = await deps.claude.beta.messages.create({
    model: deps.model || MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: ASK_SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: ASK_TOOLS,
    output_config: { effort: 'low' },
    messages,
    ...FALLBACK,
  });
  await deps.recordTokens(org, 'ask', message.usage);
  if (message.stop_reason === 'refusal') {
    throw new AiError(422, 'refused', 'The model declined this request.');
  }
  return { content: message.content, stop_reason: message.stop_reason };
};

const dtc = async (body, deps, begin) => {
  const codes = [...new Set((body.codes || []).map((code) => String(code).trim().toUpperCase()))];
  if (!codes.length || codes.length > 20 || !codes.every((code) => CODE.test(code))) {
    throw new AiError(400, 'invalid_codes');
  }
  const known = await deps.lookupCodes(codes);
  const found = new Map(known.map((row) => [row.code, row]));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length) {
    const org = await begin('dtc');
    const message = await deps.claude.beta.messages.create({
      model: deps.model || MODEL,
      max_tokens: 4000,
      system: DTC_SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: DTC_SCHEMA } },
      messages: [{ role: 'user', content: `Codes: ${missing.join(', ')}` }],
      ...FALLBACK,
    });
    await deps.recordTokens(org, 'dtc', message.usage);
    checkStop(message);
    const rows = JSON.parse(textOf(message))
      .codes.filter((row) => missing.includes(String(row.code).toUpperCase()))
      .map((row) => {
        const min = Number.isInteger(row.cost_min) && row.cost_min >= 0 ? row.cost_min : null;
        const max =
          Number.isInteger(row.cost_max) && min != null && row.cost_max >= min
            ? row.cost_max
            : null;
        return {
          code: String(row.code).toUpperCase(),
          title_he: String(row.title_he).slice(0, 200),
          explanation_he: String(row.explanation_he).slice(0, 1000),
          severity: row.severity,
          drive_today: row.drive_today,
          cost_min: max == null ? null : min,
          cost_max: max,
          source: 'ai',
        };
      });
    if (rows.length) {
      await deps.saveCodes(rows);
      rows.forEach((row) => found.set(row.code, row));
    }
  }
  return { items: codes.map((code) => found.get(code) || { code, unknown: true }) };
};

const extract = async (body, deps, org) => {
  const { kind, media_type: mediaType, data } = body;
  if (!EXTRACT_KINDS[kind]) throw new AiError(400, 'invalid_kind');
  const pdf = mediaType === 'application/pdf';
  if (!pdf && !IMAGE_TYPES.includes(mediaType)) throw new AiError(400, 'invalid_media_type');
  if (
    typeof data !== 'string' ||
    !data.length ||
    data.length > MAX_IMAGE ||
    /[^A-Za-z0-9+/=]/.test(data)
  ) {
    throw new AiError(400, 'invalid_file');
  }
  const source = { type: 'base64', media_type: mediaType, data };
  const message = await deps.claude.beta.messages.create({
    model: deps.model || MODEL,
    max_tokens: 4000,
    system: extractSystem(kind),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: extractSchema(kind) } },
    messages: [
      {
        role: 'user',
        content: [
          pdf ? { type: 'document', source } : { type: 'image', source },
          { type: 'text', text: 'Read this document.' },
        ],
      },
    ],
    ...FALLBACK,
  });
  await deps.recordTokens(org, 'extract', message.usage);
  checkStop(message);
  const result = JSON.parse(textOf(message));
  const fields = EXTRACT_KINDS[kind].fields;
  return {
    fields: result.fields,
    unsure: (result.unsure || []).filter((name) => name in fields),
  };
};

// A course is checked before it reaches anyone: whole questions with 4 options and an answer
// among them, sections with points; anything else is dropped.
export const cleanCourse = (course) => {
  const text = (value, max) =>
    String(value ?? '')
      .trim()
      .slice(0, max);
  const sections = (course?.sections || [])
    .map((section) => ({
      heading: text(section.heading, 120),
      points: (section.points || [])
        .map((point) => text(point, 400))
        .filter(Boolean)
        .slice(0, 8),
    }))
    .filter((section) => section.heading && section.points.length)
    .slice(0, 8);
  const quiz = (course?.quiz || [])
    .map((item) => ({
      question: text(item.question, 300),
      options: (item.options || []).map((option) => text(option, 200)),
      answer: Number(item.answer),
      explanation: text(item.explanation, 400),
    }))
    .filter(
      (item) =>
        item.question &&
        item.options.length === 4 &&
        item.options.every(Boolean) &&
        Number.isInteger(item.answer) &&
        item.answer >= 0 &&
        item.answer < 4,
    )
    .slice(0, 10);
  return { title: text(course?.title, 120), summary: text(course?.summary, 600), sections, quiz };
};

const course = async (body, deps, org) => {
  const { media_type: mediaType, data } = body;
  if (mediaType !== 'application/pdf') throw new AiError(400, 'invalid_media_type');
  if (
    typeof data !== 'string' ||
    !data.length ||
    data.length > MAX_IMAGE ||
    /[^A-Za-z0-9+/=]/.test(data)
  ) {
    throw new AiError(400, 'invalid_file');
  }
  const message = await deps.claude.beta.messages.create({
    model: deps.model || MODEL,
    max_tokens: 8000,
    system: COURSE_SYSTEM,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: COURSE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: 'Build the training from this procedure.' },
        ],
      },
    ],
    ...FALLBACK,
  });
  await deps.recordTokens(org, 'course', message.usage);
  checkStop(message);
  const result = cleanCourse(JSON.parse(textOf(message)));
  if (!result.sections.length || result.quiz.length < 3) {
    throw new AiError(422, 'not_a_procedure', 'This document does not read as a procedure.');
  }
  return result;
};

export const handle = async (request, deps) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return fail(405, 'method_not_allowed');
  const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s*/i, '').trim();
  if (!jwt) return fail(401, 'unauthorized');
  if (!deps.claude) return fail(503, 'not_configured', 'The AI key is not set.');
  const route = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'invalid_json');
  }
  const begin = (kind) => deps.begin(jwt, kind);
  try {
    switch (route) {
      case 'ask':
        return json(200, await ask(body, deps, await begin('ask')));
      case 'dtc':
        return json(200, await dtc(body, deps, begin));
      case 'extract':
        return json(200, await extract(body, deps, await begin('extract')));
      case 'course':
        return json(200, await course(body, deps, await begin('course')));
      default:
        return fail(404, 'not_found');
    }
  } catch (error) {
    if (error instanceof AiError) return fail(error.status, error.code, error.message);
    // The database said no (switched off, limit) - see ai_begin().
    if (error?.code === '42501') return fail(403, 'ai_disabled', error.message);
    if (error?.code === '53400') return fail(429, 'daily_limit', error.message);
    if (error?.status === 429) return fail(429, 'busy', 'The AI service is busy. Try again soon.');
    return fail(502, 'ai_failed', 'The AI service did not answer.');
  }
};
