import { describe, expect, it } from 'vitest';
import { evaluateItem, inspectionResult, issuesFromFailures, missingAnswers } from '../inspections';

const items = [
  { id: 'a', label: 'Brakes', type: 'pass_fail', critical: true },
  { id: 'b', label: 'Tire pressure', type: 'number_range', min_value: 30, max_value: 36 },
  { id: 'c', label: 'Notes', type: 'text' },
  { id: 'd', label: 'Mirrors', type: 'pass_fail', critical: false },
];

describe('inspections', () => {
  it('evaluates answers by item type', () => {
    expect(evaluateItem(items[0], 'pass')).toBe(true);
    expect(evaluateItem(items[0], 'fail')).toBe(false);
    expect(evaluateItem(items[0], undefined)).toBeNull();
    expect(evaluateItem(items[1], '32')).toBe(true);
    expect(evaluateItem(items[1], 40)).toBe(false);
    expect(evaluateItem({ type: 'number_range', min_value: 5 }, 100)).toBe(true);
    expect(evaluateItem(items[2], 'anything')).toBeNull();
  });

  it('lists unanswered required items', () => {
    expect(
      missingAnswers(items, { a: { value: 'pass' }, b: { value: '' } }).map((item) => item.id),
    ).toEqual(['b', 'd']);
  });

  it('fails the inspection and opens an issue per failed item', () => {
    const answers = {
      a: { value: 'fail', comment: 'Soft pedal' },
      b: { value: 33 },
      d: { value: 'fail' },
    };
    expect(inspectionResult(items, answers)).toBe('fail');
    expect(
      inspectionResult(items, { a: { value: 'pass' }, b: { value: 33 }, d: { value: 'pass' } }),
    ).toBe('pass');
    expect(issuesFromFailures(items, answers)).toEqual([
      { title: 'Brakes', description: 'Soft pedal', severity: 'high', source: 'inspection' },
      { title: 'Mirrors', description: null, severity: 'medium', source: 'inspection' },
    ]);
  });
});
