import { describe, expect, it } from 'vitest';
import { IDLE_MS, shouldApplyUpdate, shouldReloadAfterUpdate } from '../updatePolicy';

describe('update policy (ARC-12)', () => {
  it('takes the update in by itself only when nobody is in the middle of something', () => {
    expect(shouldApplyUpdate({ hidden: true, idleMs: 0, dirty: false })).toBe(true);
    expect(shouldApplyUpdate({ hidden: false, idleMs: IDLE_MS, dirty: false })).toBe(true);
    expect(shouldApplyUpdate({ hidden: false, idleMs: IDLE_MS - 1, dirty: false })).toBe(false);
    expect(shouldApplyUpdate({ hidden: true, idleMs: IDLE_MS, dirty: true })).toBe(false);
  });

  it('reloads the tab that asked, and other tabs only when nothing would be lost', () => {
    expect(shouldReloadAfterUpdate({ initiated: true, hidden: false, dirty: true })).toBe(true);
    expect(shouldReloadAfterUpdate({ initiated: false, hidden: true, dirty: false })).toBe(true);
    expect(shouldReloadAfterUpdate({ initiated: false, hidden: false, dirty: false })).toBe(false);
    expect(shouldReloadAfterUpdate({ initiated: false, hidden: true, dirty: true })).toBe(false);
  });
});
