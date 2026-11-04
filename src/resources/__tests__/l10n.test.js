import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../l10n/', import.meta.url);
const load = (name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

const en = load('en.json');
const he = load('he.json');

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
