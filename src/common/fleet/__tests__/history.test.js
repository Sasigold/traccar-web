import { describe, expect, it } from 'vitest';
import { changedFields, describeChanges } from '../history';

describe('entity history', () => {
  it('lists changed fields and ignores bookkeeping columns', () => {
    const row = {
      action: 'update',
      old_data: { plate_number: '1', notes: null, updated_at: 'a', license_classes: ['B'] },
      new_data: { plate_number: '2', notes: null, updated_at: 'b', license_classes: ['B', 'C'] },
    };
    expect(changedFields(row)).toEqual(['license_classes', 'plate_number']);
    expect(describeChanges(row)).toEqual(['license_classes: B → B, C', 'plate_number: 1 → 2']);
  });

  it('shows what an insert set, and nothing for a delete', () => {
    expect(
      changedFields({ action: 'insert', new_data: { a: 1, b: null, c: '', d: [], id: 'x' } }),
    ).toEqual(['a']);
    expect(changedFields({ action: 'delete', old_data: { a: 1 } })).toEqual([]);
  });
});
