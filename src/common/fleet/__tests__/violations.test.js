import { describe, expect, it } from 'vitest';
import {
  companyPenalty,
  transferDeadline,
  transferLetter,
  violationUrgency,
  violationsByDriver,
} from '../violations';

describe('ticket assignment', () => {
  it('sets the deadline 90 days after the notice arrived', () => {
    expect(transferDeadline('2026-11-01')).toBe('2027-01-30');
    expect(transferDeadline('')).toBe('');
    expect(transferDeadline('not a date')).toBe('');
  });

  it('counts down to the deadline', () => {
    const today = new Date('2026-11-10T12:00:00Z');
    expect(violationUrgency({ status: 'open', due_at: '2026-11-20' }, today)).toEqual({
      level: 'soon',
      days: 10,
    });
    expect(violationUrgency({ status: 'assigned', due_at: '2026-12-31' }, today).level).toBe('ok');
    expect(violationUrgency({ status: 'open', due_at: '2026-11-09' }, today)).toEqual({
      level: 'overdue',
      days: -1,
    });
    expect(violationUrgency({ status: 'transferred', due_at: '2026-11-09' }, today).level).toBe(
      'done',
    );
    expect(violationUrgency({ status: 'open' }, today).level).toBe('none');
  });

  it('shows what the company would pay', () => {
    expect(companyPenalty(1500)).toBe(6000);
    expect(companyPenalty(null)).toBeNull();
  });

  it('sums tickets per driver', () => {
    const rows = [
      {
        driver_id: 'd1',
        drivers: { full_name: 'דנה' },
        status: 'open',
        fine_amount: 250,
        points: 4,
      },
      {
        driver_id: 'd1',
        drivers: { full_name: 'דנה' },
        status: 'paid',
        fine_amount: 1000,
        points: 6,
        charge_driver: true,
      },
      { driver_id: null, status: 'open', fine_amount: 100 },
    ];
    expect(violationsByDriver(rows)).toEqual([
      {
        driverId: 'd1',
        name: 'דנה',
        traccarDriverId: null,
        count: 2,
        open: 1,
        fines: 1250,
        points: 10,
        toCharge: 1000,
      },
      {
        driverId: null,
        name: null,
        traccarDriverId: null,
        count: 1,
        open: 1,
        fines: 100,
        points: 0,
        toCharge: 0,
      },
    ]);
  });

  it('writes the transfer letter, with lines to fill in for missing details', () => {
    const t = (key) =>
      ({ fleetLetterBody: '{0} {1} {2}', fleetLetterDeclaration: 'I, {0}' })[key] || key;
    const format = (value, kind) => `${kind}:${new Date(value).toISOString().slice(0, 10)}`;
    const letter = transferLetter(
      {
        violation: { occurred_at: '2026-10-01T05:00:00Z', authority: 'משטרת ישראל' },
        driver: { full_name: 'דנה לוי', national_id: '123456782' },
        plate: '12-345-67',
        organization: 'הובלות בע"מ',
        today: new Date('2026-11-10T00:00:00Z'),
      },
      t,
      format,
    );
    expect(letter.to).toBe('fleetLetterTo משטרת ישראל');
    expect(letter.subject).toBe('fleetLetterSubject ________');
    expect(letter.body[0]).toBe('date:2026-10-01 clock:2026-10-01 12-345-67');
    expect(letter.body).toContain('fleetLetterNationalId: 123456782');
    expect(letter.body).toContain('fleetLetterLicense: ________');
    expect(letter.declaration).toBe('I, דנה לוי');
  });
});
