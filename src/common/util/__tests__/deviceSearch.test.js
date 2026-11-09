import { describe, expect, it } from 'vitest';
import {
  deviceSearchFields,
  highlightParts,
  locateToken,
  matchDevice,
  normalizeSearch,
  tokenizeSearch,
} from '../deviceSearch';

const groups = {
  1: { id: 1, name: 'צפון', groupId: 3 },
  3: { id: 3, name: 'הפצה', groupId: 0 },
};
const drivers = { '1B2C3D4E': { name: 'דנה לוי', uniqueId: '1B2C3D4E' } };
const truck = {
  id: 7,
  name: 'משאית 12',
  uniqueId: '860000123456',
  phone: '050-1234567',
  model: 'Volvo FH',
  groupId: 1,
  attributes: { plateNumber: '12-345-67' },
};
const position = { attributes: { driverUniqueId: '1B2C3D4E' } };
const fields = deviceSearchFields(truck, { groups, drivers, position });
const search = (query) => matchDevice(tokenizeSearch(query), fields);

describe('normalization', () => {
  it('ignores case, final letters and niqqud', () => {
    expect(normalizeSearch('Truck')).toBe('truck');
    expect(normalizeSearch('שלום')).toBe(normalizeSearch('שלומ'));
    expect(normalizeSearch('מַשָּׂאִית')).toBe('משאית');
    expect(normalizeSearch('Café')).toBe('cafe');
    expect(normalizeSearch('ק״מ')).toBe('ק"מ');
  });

  it('splits a query into words', () => {
    expect(tokenizeSearch('  משאית   12 ')).toEqual(['משאית', '12']);
    expect(tokenizeSearch('')).toEqual([]);
  });
});

describe('locating a word', () => {
  it('ranks the start of the text, then the start of a word, then anywhere', () => {
    expect(locateToken('משאית 12', 'משא').rank).toBe(3);
    expect(locateToken('משאית 12', '12').rank).toBe(2);
    expect(locateToken('משאית 12', 'אית').rank).toBe(1);
    expect(locateToken('משאית 12', 'xyz')).toBeNull();
  });

  it('prefers a later word start to an earlier hit inside a word', () => {
    expect(locateToken('Avan Van', 'van')).toEqual({ start: 5, end: 8, rank: 2 });
  });

  it('finds a plate by its digits only when asked to', () => {
    expect(locateToken('12-345-67', '1234567', true)).toEqual({ start: 0, end: 9, rank: 3 });
    expect(locateToken('12-345-67', '34567', true)).toEqual({ start: 3, end: 9, rank: 1 });
    expect(locateToken('12-345-67', '1234567', false)).toBeNull();
    expect(locateToken('12-345-67', '.7', true)).toBeNull();
  });

  it('maps a match back through niqqud and final letters', () => {
    // The niqqud under the last letter stays with it.
    expect(locateToken('מַשָּׂאִית', 'משא')).toEqual({ start: 0, end: 8, rank: 3 });
    expect(locateToken('ירושלים', 'שלימ')).toEqual({ start: 3, end: 7, rank: 1 });
  });
});

describe('matching a vehicle', () => {
  it('finds it by name, plate, driver, group, id, phone and model', () => {
    [
      'משאית',
      '1234567',
      '12-345',
      'דנה',
      'לוי',
      'צפון',
      'הפצה',
      '860000',
      '0501234567',
      'volvo',
    ].forEach((query) => expect(search(query), query).not.toBeNull());
  });

  it('needs every word to match somewhere', () => {
    expect(search('משאית דנה')).not.toBeNull();
    expect(search('משאית יוסי')).toBeNull();
  });

  it('reports which fields matched', () => {
    expect(search('דנה').fields).toEqual([{ key: 'driver', value: 'דנה לוי' }]);
    expect(search('1234567').fields).toEqual([{ key: 'plate', value: '12-345-67' }]);
  });

  it('scores a start above a hit inside, and the name above the phone', () => {
    expect(search('משא').score).toBeGreaterThan(search('שאית').score);
    const van = deviceSearchFields({ name: '1234 van', phone: '1234', attributes: {} });
    const result = matchDevice(['1234'], van);
    expect(result.fields[0].key).toBe('name');
  });

  it('matches everything with an empty query', () => {
    expect(matchDevice([], fields)).toEqual({ score: 0, fields: [] });
  });

  it('survives cyclic groups', () => {
    const cyclic = { 1: { name: 'a', groupId: 2 }, 2: { name: 'b', groupId: 1 } };
    expect(
      deviceSearchFields({ name: 'x', groupId: 1, attributes: {} }, { groups: cyclic }),
    ).toHaveLength(3);
  });
});

describe('highlighting', () => {
  it('splits the text around every match, merging overlaps', () => {
    expect(highlightParts('משאית 12', ['משא', '12'])).toEqual([
      { text: 'משא', match: true },
      { text: 'ית ', match: false },
      { text: '12', match: true },
    ]);
    expect(highlightParts('abcdef', ['bcd', 'cde'])).toEqual([
      { text: 'a', match: false },
      { text: 'bcde', match: true },
      { text: 'f', match: false },
    ]);
    expect(highlightParts('12-345-67', ['34567'], true)).toEqual([
      { text: '12-', match: false },
      { text: '345-67', match: true },
    ]);
    expect(highlightParts('plain', [])).toEqual([{ text: 'plain', match: false }]);
  });
});
