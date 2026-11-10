import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../l10n/', import.meta.url);
const load = (name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

const en = load('en.json');
const he = load('he.json');
const ar = load('ar.json');
const ru = load('ru.json');

// Placeholders like {0} or %s must survive translation, or the UI shows broken text.
const placeholders = (value) => (value.match(/\{\d+\}|%[sd]/g) || []).sort().join(',');

describe('translations', () => {
  it('every English string exists in Hebrew', () => {
    expect(Object.keys(en).filter((key) => !(key in he))).toEqual([]);
  });

  it('Hebrew has no keys that English lacks', () => {
    expect(Object.keys(he).filter((key) => !(key in en))).toEqual([]);
  });

  it('no Hebrew string is empty', () => {
    expect(Object.entries(he).filter(([, value]) => !String(value).trim())).toEqual([]);
  });

  it('Hebrew keeps the same placeholders as English', () => {
    const broken = Object.keys(en).filter(
      (key) => key in he && placeholders(en[key]) !== placeholders(he[key]),
    );
    expect(broken).toEqual([]);
  });

  it('every locale file is valid JSON', () => {
    readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .forEach((name) => expect(() => load(name)).not.toThrow());
  });
});

describe('shipped languages (FND-09)', () => {
  it('only the languages the app offers are kept', () => {
    expect(
      readdirSync(dir)
        .filter((name) => name.endsWith('.json'))
        .sort(),
    ).toEqual(['ar.json', 'en.json', 'he.json', 'ru.json']);
  });
});

// A11-10: every literal key the code asks for exists, and the driver's screens are complete in
// Arabic and Russian (the languages many drivers read best).
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const sourceFiles = (dir) =>
  readdirSync(new URL(`../../${dir}`, import.meta.url), { recursive: true, withFileTypes: false })
    .filter((name) => /\.(js|jsx)$/.test(name) && !name.includes('__tests__'))
    .map((name) => `${dir}/${name}`);
const literalKeys = (path) =>
  [...read(path).matchAll(/\bt\(\s*'([A-Za-z0-9]+)'\s*\)/g)].map((m) => m[1]);

describe('keys in the code', () => {
  it('every literal key exists in English and Hebrew', () => {
    const missing = sourceFiles('.')
      .flatMap((path) => literalKeys(path).map((key) => [path, key]))
      .filter(([, key]) => !(key in en) || !(key in he));
    expect(missing).toEqual([]);
  });
});

const DRIVER_SCREENS = [
  'fleet/DriverPortalPage.jsx',
  'fleet/DriverCheckInPage.jsx',
  'fleet/DriverDamagePage.jsx',
  'fleet/DriverHandoverPage.jsx',
  'fleet/InspectionPage.jsx',
  'fleet/components/DriverJobsCard.jsx',
  'common/components/shell/navItems.js',
];
const DRIVER_FAMILIES = [
  'fleetJobStatus',
  'fleetJobAction',
  'fleetJobFailure',
  'fleetIncidentType',
];

describe.each([
  ['ar', ar],
  ['ru', ru],
])('the driver screens in %s', (name, dictionary) => {
  it('have every string, with the same placeholders', () => {
    const keys = new Set([
      ...DRIVER_SCREENS.flatMap((path) => literalKeys(path)),
      ...Object.keys(en).filter((key) => DRIVER_FAMILIES.some((family) => key.startsWith(family))),
    ]);
    const missing = [...keys].filter((key) => key in en && !(key in dictionary));
    expect(missing).toEqual([]);
    const broken = [...keys].filter(
      (key) => key in dictionary && placeholders(en[key]) !== placeholders(dictionary[key]),
    );
    expect(broken).toEqual([]);
  });
});
