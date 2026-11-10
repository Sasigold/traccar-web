import { afterEach, describe, expect, it, vi } from 'vitest';
import { goBack, listPathOf, setBackSentinel } from '../unsavedChanges';

// ADM-14: "back" from a form opened directly stays in the app.
describe('goBack', () => {
  const at = (idx) => vi.stubGlobal('window', { history: { state: { idx }, go: vi.fn() } });
  afterEach(() => {
    setBackSentinel(false);
    vi.unstubAllGlobals();
  });

  it('steps back when the app has a page behind the form', () => {
    at(3);
    const navigate = vi.fn();
    goBack(navigate, '/settings/groups');
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('goes to the list when the form was opened directly', () => {
    at(0);
    const navigate = vi.fn();
    goBack(navigate, '/settings/groups');
    expect(navigate).toHaveBeenCalledWith('/settings/groups', { replace: true });
  });

  it('skips the guard entry when there is one', () => {
    at(2);
    setBackSentinel(true);
    const navigate = vi.fn();
    goBack(navigate, '/x');
    expect(window.history.go).toHaveBeenCalledWith(-2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('names the list of a form', () => {
    expect(listPathOf('/settings/group/5')).toBe('/settings/groups');
    expect(listPathOf('/settings/user')).toBe('/settings/users');
    expect(listPathOf('/settings/maintenance/12')).toBe('/settings/maintenances');
  });
});
