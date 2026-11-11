import { describe, expect, it } from 'vitest';
import { isSafetyAlert, ruleFromAlert, ruleFromAnswer, ruleLink } from '../alertLinks';

describe('where an alert leads (LIV-24)', () => {
  it('sends driving behavior to the safety inbox', () => {
    expect(isSafetyAlert({ type: 'alarm', attributes: { alarm: 'hardBraking' } })).toBe(true);
    expect(isSafetyAlert({ type: 'alarm', attributes: { alarm: 'lowBattery,accident' } })).toBe(
      true,
    );
    expect(isSafetyAlert({ type: 'deviceOverspeed' })).toBe(true);
    expect(isSafetyAlert({ type: 'alarm', attributes: { alarm: 'lowBattery' } })).toBe(false);
    expect(isSafetyAlert({ type: 'geofenceExit' })).toBe(false);
  });

  it('suggests a rule of the same kind', () => {
    expect(ruleFromAlert({ type: 'deviceOverspeed', attributes: { speed: 64.8 } })).toEqual({
      template: 'overspeed',
      params: { speed: 120 },
    });
    expect(ruleFromAlert({ type: 'geofenceEnter', geofenceId: 7 })).toEqual({
      template: 'geofenceEnter',
      params: { geofenceId: 7 },
    });
    expect(ruleFromAlert({ type: 'ignitionOn' })).toBeNull();
    expect(ruleLink(ruleFromAlert({ type: 'geofenceEnter', geofenceId: 7 }))).toBe(
      '/fleet/automations?template=geofenceEnter&params=%7B%22geofenceId%22%3A7%7D',
    );
  });
});

describe('an assistant answer as a rule (AI-01)', () => {
  it('reads the question and the data behind the answer', () => {
    expect(ruleFromAnswer([], 'מי נסע בשבת?')).toEqual({ template: 'restDay', params: {} });
    expect(ruleFromAnswer([], 'מי נסע בלילה השבוע?')).toEqual({
      template: 'afterHours',
      params: {},
    });
    expect(
      ruleFromAnswer(
        [{ name: 'events', input: { types: ['deviceOverspeed'] } }],
        'מי עבר 100 קמ"ש?',
      ),
    ).toEqual({ template: 'overspeed', params: { speed: 100 } });
    expect(ruleFromAnswer([{ name: 'stops', input: {} }], 'מי עמד בסרק יותר מ-20 דקות?')).toEqual({
      template: 'idling',
      params: { minutes: 20 },
    });
    expect(ruleFromAnswer([{ name: 'fleet_summary', input: {} }], 'כמה נסענו?')).toBeNull();
  });
});
