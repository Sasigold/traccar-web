// The fixed parts of every model call: system prompts, the questions' tools and the output
// schemas. Nothing here comes from the browser.

export const MODEL = 'claude-opus-5-5';

// ─── AI-01: questions about the fleet ───────────────────────────────────────

export const ASK_SYSTEM = `You are the fleet assistant of viper fleet, an Israeli fleet tracking system.
Answer the fleet manager's question about their own fleet, in the language of the question
(usually Hebrew; address the reader in the plural, gender-neutral form).

You can only see data through the tools. Use them; never guess numbers. The tools run in the
manager's browser with the manager's own permissions, so a tool may return less than the whole
fleet: say so when it matters. Times are Asia/Jerusalem.

Reply briefly: one or two sentences with the answer, then the numbers behind it. When the answer
is a list or a comparison, return it as a table through the show_table tool instead of writing it
out. End with up to three short follow-up questions through the suggest_followups tool.
If a question cannot be answered with the tools, say what is missing and stop.`;

const PERIOD = {
  type: 'object',
  properties: {
    from: { type: 'string', description: 'Start, ISO 8601 date-time' },
    to: { type: 'string', description: 'End, ISO 8601 date-time' },
  },
  required: ['from', 'to'],
  additionalProperties: false,
};

const VEHICLES = {
  type: 'array',
  items: { type: 'integer' },
  description: 'Vehicle ids from list_vehicles; empty for the whole fleet',
};

export const ASK_TOOLS = [
  {
    name: 'list_vehicles',
    description:
      'The vehicles the manager sees: id, name, plate, group, status (online/offline), last update, driver.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'fleet_summary',
    description:
      'Per vehicle for a period: distance (km), engine hours, driving hours, idle hours, fuel used (l), max and average speed (km/h).',
    input_schema: {
      type: 'object',
      properties: { period: PERIOD, vehicle_ids: VEHICLES },
      required: ['period', 'vehicle_ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'trips',
    description:
      'Trips in a period: vehicle, start and end time and address, distance (km), duration, max speed, driver.',
    input_schema: {
      type: 'object',
      properties: { period: PERIOD, vehicle_ids: VEHICLES },
      required: ['period', 'vehicle_ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'stops',
    description: 'Stops in a period: vehicle, start and end time, duration, address.',
    input_schema: {
      type: 'object',
      properties: { period: PERIOD, vehicle_ids: VEHICLES },
      required: ['period', 'vehicle_ids'],
      additionalProperties: false,
    },
  },
  {
    name: 'events',
    description:
      'Alerts in a period: overspeed, geofence enter/exit, alarms, ignition, maintenance. Optional type filter.',
    input_schema: {
      type: 'object',
      properties: {
        period: PERIOD,
        vehicle_ids: VEHICLES,
        types: { type: 'array', items: { type: 'string' } },
      },
      required: ['period', 'vehicle_ids', 'types'],
      additionalProperties: false,
    },
  },
  {
    name: 'expiries',
    description:
      'Validity dates that are expired or due within the given days: vehicle test, insurance, driver licenses, documents.',
    input_schema: {
      type: 'object',
      properties: { within_days: { type: 'integer', description: '0 to 365' } },
      required: ['within_days'],
      additionalProperties: false,
    },
  },
  {
    name: 'costs',
    description:
      'Fleet costs in a period (fuel, maintenance, expenses) per vehicle and category, in shekels.',
    input_schema: {
      type: 'object',
      properties: { period: PERIOD },
      required: ['period'],
      additionalProperties: false,
    },
  },
  {
    name: 'show_table',
    description: 'Show the answer as a table to the manager (shown under your text).',
    input_schema: {
      type: 'object',
      properties: {
        columns: { type: 'array', items: { type: 'string' } },
        rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['columns', 'rows'],
      additionalProperties: false,
    },
  },
  {
    name: 'suggest_followups',
    description: 'Up to three short follow-up questions the manager may ask next.',
    input_schema: {
      type: 'object',
      properties: { questions: { type: 'array', items: { type: 'string' } } },
      required: ['questions'],
      additionalProperties: false,
    },
  },
].map((tool) => ({ ...tool, strict: true }));

export const ASK_TOOL_NAMES = ASK_TOOLS.map((tool) => tool.name);

// ─── AI-03: fault codes ─────────────────────────────────────────────────────

export const DTC_SYSTEM = `You explain vehicle diagnostic trouble codes (OBD-II) to an Israeli fleet manager
who is not a mechanic. For each code give: a short plain Hebrew title, two sentences in Hebrew on
what it means and what to do, the severity (low, medium, high, critical), whether the vehicle can
finish today's route (yes, caution, no), and a typical repair cost range in Israeli shekels at a
regular garage. When a code is manufacturer specific or unknown, say so in the explanation and be
conservative: severity medium, drive_today caution, no cost range.`;

export const DTC_SCHEMA = {
  type: 'object',
  properties: {
    codes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          title_he: { type: 'string' },
          explanation_he: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          drive_today: { type: 'string', enum: ['yes', 'caution', 'no'] },
          cost_min: { type: ['integer', 'null'] },
          cost_max: { type: ['integer', 'null'] },
        },
        required: [
          'code',
          'title_he',
          'explanation_he',
          'severity',
          'drive_today',
          'cost_min',
          'cost_max',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['codes'],
  additionalProperties: false,
};

// ─── AI-04: documents ───────────────────────────────────────────────────────

const field = { type: ['string', 'null'] };

export const EXTRACT_KINDS = {
  vehicle_license: {
    title: 'an Israeli vehicle license (רישיון רכב)',
    fields: {
      plate_number: field,
      test_expiry: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      make: field,
      model: field,
      model_year: { type: ['integer', 'null'] },
      vin: field,
      owner_name: field,
    },
  },
  insurance: {
    title: 'a vehicle insurance policy (compulsory or comprehensive)',
    fields: {
      plate_number: field,
      insurer: field,
      policy_number: field,
      kind: { type: ['string', 'null'], description: 'compulsory or comprehensive' },
      valid_from: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      valid_until: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    },
  },
  driver_license: {
    title: 'an Israeli driving license (רישיון נהיגה)',
    fields: {
      full_name: field,
      national_id: field,
      license_number: field,
      license_classes: { type: 'array', items: { type: 'string' } },
      expiry: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
    },
  },
  garage_invoice: {
    title: 'a garage invoice',
    fields: {
      vendor_name: field,
      invoice_number: field,
      date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
      plate_number: field,
      odometer: { type: ['integer', 'null'] },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            kind: { type: 'string', enum: ['part', 'labor', 'other'] },
            quantity: { type: ['number', 'null'] },
            amount: { type: ['number', 'null'] },
          },
          required: ['description', 'kind', 'quantity', 'amount'],
          additionalProperties: false,
        },
      },
      subtotal: { type: ['number', 'null'] },
      vat: { type: ['number', 'null'] },
      total: { type: ['number', 'null'] },
    },
  },
};

export const extractSchema = (kind) => {
  const { fields } = EXTRACT_KINDS[kind];
  return {
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        properties: fields,
        required: Object.keys(fields),
        additionalProperties: false,
      },
      unsure: {
        type: 'array',
        items: { type: 'string', enum: Object.keys(fields) },
        description: 'Fields that were hard to read or guessed',
      },
    },
    required: ['fields', 'unsure'],
    additionalProperties: false,
  };
};

export const extractSystem = (
  kind,
) => `You read ${EXTRACT_KINDS[kind].title} from a photo or scan and fill in its
fields. Copy values as printed; write dates as YYYY-MM-DD and plates with their digits. When a
field is not on the document, give null. List in "unsure" every field you could not read clearly
or had to guess: the manager checks those before anything is saved. If the image is not this kind
of document, return every field as null and list none.`;

// ─── AI-10: a short course from a procedure ─────────────────────────────────

export const COURSE_SYSTEM = `You turn a company procedure (a PDF the fleet manager uploads) into a
short training for professional drivers in Israel, in Hebrew. Write for a driver reading on a phone
between jobs: plain words, second person plural ("אתם"), short sentences, no legal language.
Keep only what the procedure says; never add rules, numbers or claims that are not in it. Make
3 to 6 sections of 2 to 5 short points each, then a quiz of 5 to 8 multiple-choice questions with
4 options each, one correct, testing what matters most for safety and compliance, each with a
one-sentence explanation that quotes or paraphrases the procedure. If the document is not a
procedure or policy, return an empty sections list and an empty quiz.`;

export const COURSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
        },
        required: ['heading', 'points'],
        additionalProperties: false,
      },
    },
    quiz: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer: { type: 'integer' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'answer', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'summary', 'sections', 'quiz'],
  additionalProperties: false,
};
