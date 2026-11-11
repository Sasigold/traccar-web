import { describe, expect, it, vi } from 'vitest';
import { cleanCourse, handle } from '../core.js';
import { COURSE_SCHEMA } from '../prompts.js';

const post = (body) =>
  new Request('https://api.example.com/functions/v1/fleet-ai/course', {
    method: 'POST',
    headers: { Authorization: 'Bearer jwt-1', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const question = (answer = 1) => ({
  question: 'מה עושים לפני נסיעה?',
  options: ['כלום', 'בדיקת בוקר', 'קפה', 'שיחה'],
  answer,
  explanation: 'הנוהל מחייב בדיקת בוקר.',
});

const course = {
  title: 'נוהל בדיקת בוקר',
  summary: 'מה בודקים לפני היציאה.',
  sections: [{ heading: 'צמיגים', points: ['בודקים לחץ', 'בודקים חריץ'] }],
  quiz: [question(), question(2), question(0)],
};

const deps = (result) => ({
  claude: {
    beta: {
      messages: {
        create: vi.fn(async () => ({
          content: [{ type: 'text', text: JSON.stringify(result) }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 5000, output_tokens: 900 },
        })),
      },
    },
  },
  begin: vi.fn(async () => 'org-1'),
  recordTokens: vi.fn(async () => {}),
});

describe('a course from a procedure (AI-10)', () => {
  it('reads the PDF with the course prompt and schema, and counts it', async () => {
    const d = deps(course);
    const response = await handle(post({ media_type: 'application/pdf', data: 'JVBERi0x' }), d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(course);
    const params = d.claude.beta.messages.create.mock.calls[0][0];
    expect(params.messages[0].content[0]).toMatchObject({ type: 'document' });
    expect(params.output_config.format.schema).toBe(COURSE_SCHEMA);
    expect(d.begin).toHaveBeenCalledWith('jwt-1', 'course');
    expect(d.recordTokens).toHaveBeenCalledWith('org-1', 'course', expect.any(Object));
  });

  it('takes only PDFs', async () => {
    const response = await handle(post({ media_type: 'image/png', data: 'AAAA' }), deps(course));
    expect(response.status).toBe(400);
  });

  it('drops broken questions and refuses what is not a procedure', async () => {
    expect(
      cleanCourse({
        ...course,
        quiz: [question(), { ...question(), answer: 4 }, { ...question(), options: ['a', 'b'] }],
      }).quiz,
    ).toHaveLength(1);
    const response = await handle(
      post({ media_type: 'application/pdf', data: 'JVBERi0x' }),
      deps({ ...course, sections: [], quiz: [] }),
    );
    expect(response.status).toBe(422);
  });
});
