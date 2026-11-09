import { describe, expect, it } from 'vitest';
import { privacyRegister } from '../privacyRegister';

const t = (key) => key;

describe('privacy register (SEC-12)', () => {
  it('fills in the policy', () => {
    const register = privacyRegister(t, {
      policy: {
        retention_days: 180,
        view_log_days: 730,
        hide_outside_hours: true,
        work_start: '07:00:00',
        work_end: '19:00:00',
        allow_private_switch: true,
      },
    });
    const data = register.sections.find((section) => section.title === 'privacyRegisterData');
    expect(data.table.rows.map((row) => row[1])).toEqual([
      'privacyRegisterDays',
      'privacyRegisterWhileEmployed',
      'privacyRegisterBySubject',
      'privacyRegisterDays',
    ]);
    const limits = register.sections.find((section) => section.title === 'privacyRegisterLimits');
    expect(limits.items).toContain('privacyRegisterPrivateOn');
  });

  it('lists only the services this build uses', () => {
    const recipients = (services) =>
      privacyRegister(t, { policy: {}, services }).sections.find(
        (section) => section.title === 'privacyRegisterRecipients',
      ).items;
    expect(recipients({})).toEqual([
      'privacyRegisterRecipientHosting',
      'privacyRegisterRecipientTraccar',
    ]);
    expect(
      recipients({ messaging: true, errors: 'glitchtip.example.com', analytics: 'umami' }),
    ).toHaveLength(5);
  });

  it('says when retention is not set', () => {
    const data = privacyRegister(t, { policy: {} }).sections.find(
      (section) => section.title === 'privacyRegisterData',
    );
    expect(data.table.rows[0][1]).toBe('privacyRegisterNotSet');
  });
});
