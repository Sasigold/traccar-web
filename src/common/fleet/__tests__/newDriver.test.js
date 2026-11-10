import { describe, expect, it } from 'vitest';
import { newDriverConflict, newDriverStatus } from '../newDriver';

const at = (text) => new Date(`${text}T12:00:00`);

describe('new drivers (ISR-12)', () => {
  it('is new for two years from the issue date', () => {
    expect(newDriverStatus('2026-01-15', at('2026-11-10'))).toMatchObject({ until: '2028-01-15' });
    expect(newDriverStatus('2024-11-10', at('2026-11-10'))).toBeNull();
    expect(newDriverStatus('2024-11-11', at('2026-11-10'))).not.toBeNull();
  });

  it('needs an escort for three months by day and six at night', () => {
    expect(newDriverStatus('2026-09-01', at('2026-11-10'))).toMatchObject({
      escortDay: true,
      escortNight: true,
      escortUntil: '2027-03-01',
    });
    expect(newDriverStatus('2026-07-01', at('2026-11-10'))).toMatchObject({
      escortDay: false,
      escortNight: true,
    });
    expect(newDriverStatus('2026-01-01', at('2026-11-10'))).toMatchObject({
      escortDay: false,
      escortNight: false,
      escortUntil: null,
    });
  });

  it('ignores unknown and future dates', () => {
    expect(newDriverStatus(null)).toBeNull();
    expect(newDriverStatus('nonsense')).toBeNull();
    expect(newDriverStatus('2027-01-01', at('2026-11-10'))).toBeNull();
  });

  it('warns only for a new driver on a vehicle marked for experienced drivers', () => {
    const now = at('2026-11-10');
    expect(newDriverConflict({ licenseIssued: '2026-05-01' }, { noNewDrivers: true }, now)).toBe(
      true,
    );
    expect(newDriverConflict({ licenseIssued: '2026-05-01' }, {}, now)).toBe(false);
    expect(newDriverConflict({ licenseIssued: '2010-05-01' }, { noNewDrivers: true }, now)).toBe(
      false,
    );
  });
});
