import { describe, expect, it } from 'vitest';
import { answerOf } from '../useAssistant';

describe('an assistant answer (AI-01)', () => {
  it('gathers the text, the tables, the follow-ups and the report behind the data', () => {
    const period = { from: '2026-11-01T00:00:00Z', to: '2026-11-08T00:00:00Z' };
    const answer = answerOf([
      {
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'tool_use', id: 'a', name: 'trips', input: { period, vehicle_ids: [3] } },
        ],
      },
      {
        content: [
          { type: 'text', text: 'ואן 3 נסע 412 ק"מ.' },
          {
            type: 'tool_use',
            id: 'b',
            name: 'show_table',
            input: { columns: ['רכב', 'ק"מ'], rows: [['ואן 3', '412']] },
          },
          {
            type: 'tool_use',
            id: 'c',
            name: 'suggest_followups',
            input: { questions: ['א', 'ב', 'ג', 'ד'] },
          },
        ],
      },
    ]);
    expect(answer.text).toBe('ואן 3 נסע 412 ק"מ.');
    expect(answer.tables).toHaveLength(1);
    expect(answer.followups).toEqual(['א', 'ב', 'ג']);
    expect(answer.link).toMatch(/^\/reports\/trips\?.*deviceId=3/);
    expect(answer.steps).toEqual(['trips']);
  });
});
