import { describe, expect, it } from 'vitest';
import {
  addMonths,
  garageLicenseIssue,
  quarterOf,
  quarterSummary,
  safetyTasks,
} from '../safetyOfficer';

const today = new Date('2026-11-10T09:00:00Z');

describe('safety officer work plan', () => {
  it('adds calendar months, keeping the end of the month', () => {
    expect(addMonths('2026-08-15', 3)).toBe('2026-11-15');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });

  it('plans meetings for professional drivers and licence checks for everyone', () => {
    const tasks = safetyTasks(
      {
        drivers: [
          { id: 'p', full_name: 'מקצועי', is_professional: true },
          { id: 'o', full_name: 'רגיל', is_professional: false },
          { id: 'x', full_name: 'לא פעיל', status: 'inactive' },
        ],
        reviews: [
          { driver_id: 'p', kind: 'periodic', held_at: '2026-08-01', driver_signed_at: null },
          { driver_id: 'p', kind: 'conversation', held_at: '2026-10-01' },
        ],
        checks: [
          { driver_id: 'p', checked_at: '2026-06-01' },
          { driver_id: 'o', checked_at: '2025-01-01', next_check_at: '2027-12-31' },
        ],
      },
      {},
      today,
    );
    const meeting = tasks.find((task) => task.kind === 'meeting');
    expect(meeting).toMatchObject({
      driverId: 'p',
      dueAt: '2026-11-01',
      status: 'overdue',
      unsigned: true,
    });
    const checkP = tasks.find((task) => task.kind === 'licenseCheck' && task.driverId === 'p');
    expect(checkP).toMatchObject({ dueAt: '2026-12-01', status: 'ok', days: 21 });
    const checkO = tasks.find((task) => task.kind === 'licenseCheck' && task.driverId === 'o');
    expect(checkO.dueAt).toBe('2027-12-31');
    expect(tasks.some((task) => task.driverId === 'x')).toBe(false);
    expect(tasks[0]).toBe(meeting); // most urgent first
  });

  it('asks for an investigation of each accident that has none', () => {
    const tasks = safetyTasks(
      {
        incidents: [
          { id: 'i1', type: 'accident', occurred_at: '2026-11-01T10:00:00Z', number: 17 },
          { id: 'i2', type: 'accident', occurred_at: '2026-10-01T10:00:00Z' },
          { id: 'i3', type: 'glass', occurred_at: '2026-11-01T10:00:00Z' },
        ],
        investigations: [{ incident_id: 'i2' }],
      },
      {},
      today,
    );
    expect(tasks).toEqual([
      expect.objectContaining({
        kind: 'investigation',
        incidentId: 'i1',
        dueAt: '2026-11-15',
        status: 'soon',
      }),
    ]);
  });

  it('follows each tachograph from its last download', () => {
    const tasks = safetyTasks(
      {
        tachographs: [
          { kind: 'vehicle', vehicle_id: 'v1', downloaded_at: '2026-09-01' },
          { kind: 'vehicle', vehicle_id: 'v1', downloaded_at: '2026-10-20' },
          { kind: 'card', driver_id: 'p', downloaded_at: '2026-11-05' },
        ],
      },
      { tachographDays: 28 },
      today,
    );
    expect(tasks.map((task) => [task.tachographKind, task.dueAt, task.status])).toEqual([
      ['vehicle', '2026-11-17', 'soon'],
      ['card', '2026-12-03', 'ok'],
    ]);
  });

  it('sums the quarter for the owner', () => {
    const quarter = quarterOf(today);
    expect(quarter).toMatchObject({ from: '2026-10-01', to: '2026-12-31', quarter: 4 });
    const summary = quarterSummary(
      {
        reviews: [
          { kind: 'periodic', held_at: '2026-10-05', driver_signed_at: '2026-10-06' },
          { kind: 'periodic', held_at: '2026-09-30' },
          { kind: 'investigation', held_at: '2026-11-02' },
        ],
        checks: [{ checked_at: '2026-10-10' }],
        incidents: [{ type: 'accident', occurred_at: '2026-11-01T10:00:00Z' }],
      },
      [{ status: 'overdue' }, { status: 'soon' }, { status: 'ok' }],
      quarter,
    );
    expect(summary).toMatchObject({
      meetings: 1,
      meetingsSigned: 1,
      investigations: 1,
      licenseChecks: 1,
      accidents: 1,
      overdue: 1,
      soon: 1,
    });
  });

  it('flags garages without a valid licence', () => {
    expect(garageLicenseIssue({ type: 'tires' }, today)).toBeNull();
    expect(garageLicenseIssue({ type: 'garage', licensed: false }, today)).toBe('unlicensed');
    expect(garageLicenseIssue({ type: 'garage' }, today)).toBe('unknown');
    expect(
      garageLicenseIssue(
        { type: 'garage', licensed: true, license_valid_until: '2026-11-09' },
        today,
      ),
    ).toBe('expired');
    expect(
      garageLicenseIssue(
        { type: 'garage', licensed: true, license_valid_until: '2026-11-10' },
        today,
      ),
    ).toBeNull();
  });
});
