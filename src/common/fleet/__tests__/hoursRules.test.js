import { describe, expect, it } from 'vitest';
import {
  activePermits,
  applyPermits,
  driverClass,
  rulesFor,
  validPermit,
  vehicleClass,
} from '../hoursRules';

const settings = {
  maxDailyDriving: 600,
  byClass: { heavy: { maxDailyDriving: 540, maxContinuousDriving: 240 } },
  permits: [
    {
      id: 'p1',
      name: 'היתר חירום 2026',
      from: '2026-11-10',
      to: '2026-11-20',
      classes: ['heavy'],
      rules: { maxDailyDriving: 720 },
    },
    {
      id: 'p2',
      name: 'כולם',
      from: '2026-12-01',
      to: '2026-12-02',
      classes: [],
      rules: { minDailyRest: 360 },
    },
  ],
};

describe('vehicleClass', () => {
  it('reads the Traccar category', () => {
    expect(vehicleClass('truck')).toBe('heavy');
    expect(vehicleClass('bus')).toBe('bus');
    expect(vehicleClass('car')).toBe('light');
    expect(vehicleClass(undefined)).toBe('light');
  });

  it('takes the strictest kind a driver drove', () => {
    expect(driverClass(['light', 'heavy', 'bus'])).toBe('heavy');
    expect(driverClass(['light', 'bus'])).toBe('bus');
    expect(driverClass([])).toBe('light');
  });
});

describe('rulesFor', () => {
  it('layers defaults, base, kind and permits', () => {
    expect(rulesFor(settings, 'light').maxDailyDriving).toBe(600);
    expect(rulesFor(settings, 'heavy').maxDailyDriving).toBe(540);
    expect(rulesFor(settings, 'heavy', '2026-11-15').maxDailyDriving).toBe(720);
    expect(rulesFor(settings, 'heavy', '2026-11-21').maxDailyDriving).toBe(540);
    // The permit is for heavy vehicles only.
    expect(rulesFor(settings, 'light', '2026-11-15').maxDailyDriving).toBe(600);
    // A permit for every vehicle.
    expect(rulesFor(settings, 'bus', '2026-12-01').minDailyRest).toBe(360);
    expect(rulesFor({}, 'light').minWeeklyRest).toBe(25 * 60);
  });

  it('ignores what is not a number', () => {
    expect(rulesFor({ maxDailyDriving: 'x', byClass: { light: { foo: 1 } } }).maxDailyDriving).toBe(
      12 * 60,
    );
  });

  it('lists the permits in force', () => {
    expect(activePermits(settings, 'heavy', '2026-11-20').map((p) => p.id)).toEqual(['p1']);
    expect(activePermits(settings, 'heavy', '2026-11-09')).toEqual([]);
  });
});

describe('applyPermits', () => {
  it('excuses what a permit allowed that day, and keeps the rest', () => {
    const violations = [
      { type: 'daily', day: '2026-11-15', minutes: 700 },
      { type: 'daily', day: '2026-11-15', minutes: 730 },
      { type: 'daily', day: '2026-11-25', minutes: 600 },
      { type: 'continuous', day: '2026-11-15', minutes: 250 },
    ];
    const result = applyPermits(violations, settings, 'heavy');
    expect(result.violations).toEqual([violations[1], violations[2], violations[3]]);
    expect(result.excused).toEqual([{ ...violations[0], permit: 'היתר חירום 2026' }]);
  });

  it('handles rest, where less is the breach', () => {
    const result = applyPermits(
      [{ type: 'rest', day: '2026-12-01', minutes: 400 }],
      settings,
      'light',
    );
    expect(result.violations).toEqual([]);
    expect(result.excused[0].permit).toBe('כולם');
  });
});

describe('validPermit', () => {
  it('needs a name, dates in order and a limit', () => {
    expect(validPermit(settings.permits[0])).toBe(true);
    expect(validPermit({ ...settings.permits[0], to: '2026-11-01' })).toBe(false);
    expect(validPermit({ ...settings.permits[0], rules: {} })).toBe(false);
    expect(validPermit({ ...settings.permits[0], name: ' ' })).toBe(false);
  });
});
