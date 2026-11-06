import { describe, expect, it } from 'vitest';
import { changedFields, describeChanges, isHiddenField, linkedIds } from '../history';

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

describe('readable history', () => {
  it('hides technical columns and applies labels and formats', () => {
    const row = {
      action: 'insert',
      new_data: {
        created_by: 'u1',
        driver_id: 'd1',
        is_primary: true,
        traccar_device_id: 13,
        file_path: 'x/y',
      },
    };
    expect(
      describeChanges(row, 4, {
        hide: isHiddenField,
        label: (key) => key.toUpperCase(),
        format: (key, value) => (key === 'driver_id' ? 'Dana' : String(value)),
      }),
    ).toEqual(['DRIVER_ID: Dana', 'IS_PRIMARY: true']);
  });

  it('collects linked ids', () => {
    expect(
      linkedIds(
        [
          { old_data: { driver_id: 'a' }, new_data: { driver_id: 'b' } },
          { new_data: { driver_id: 'a' } },
        ],
        'driver_id',
      ),
    ).toEqual(['a', 'b']);
  });
});
