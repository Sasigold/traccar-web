import { useCallback, useEffect, useState } from 'react';

// ADM-05: forms with changes that were not saved. A form calls useUnsavedChanges(dirty); the
// guard (UnsavedChangesGuard) asks before the user leaves through a link, the phone tabs, the back
// arrow or the browser's back button, and the browser asks before the tab closes or reloads.
const dirtyForms = new Set();
const listeners = new Set();

// The extra history entry the guard adds to catch the browser's back button (see
// UnsavedChangesGuard). Going back on purpose must skip it.
let sentinel = false;
export const setBackSentinel = (value) => {
  sentinel = value;
};
export const hasBackSentinel = () => sentinel;

// "Back" from a form (Cancel, or after saving): one step, or two over the guard's extra entry.
// A form opened directly (a link, a reload) has nothing of the app behind it: going back would
// leave the app, so it goes to `fallback` (the list) instead. React Router counts the entries
// it pushed in history.state.idx.
export const goBack = (navigate, fallback = '/') => {
  const index = window.history.state?.idx ?? 0;
  if (sentinel) {
    sentinel = false;
    if (index >= 2) {
      window.history.go(-2);
      return;
    }
  } else if (index >= 1) {
    navigate(-1);
    return;
  }
  navigate(fallback, { replace: true });
};

// The list a form belongs to: /settings/group/5 → /settings/groups.
export const listPathOf = (pathname) =>
  pathname
    .replace(/\/\d+$/, '')
    .replace(/\/$/, '')
    .replace(/([a-z])$/, '$1s');

const notify = () => listeners.forEach((listener) => listener(dirtyForms.size > 0));

export const hasUnsavedChanges = () => dirtyForms.size > 0;

export const onUnsavedChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Forget every pending change: the user chose to leave, or the form was just saved and leaves
// on its own.
export const discardUnsavedChanges = () => {
  dirtyForms.clear();
  notify();
};

const beforeUnload = (event) => {
  if (dirtyForms.size) {
    event.preventDefault();
    // Older browsers show their own text only when returnValue is set.
    event.returnValue = '';
  }
};

export const useUnsavedChanges = (dirty) => {
  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    const token = {};
    dirtyForms.add(token);
    notify();
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      dirtyForms.delete(token);
      notify();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [dirty]);
};

// Leaving on purpose (a Cancel button, a tab): `leave` runs at once without changes, or after the
// user agrees to drop them. `confirm` is useConfirm().
export const useLeaveGuard = (confirm, t) =>
  useCallback(
    async (leave) => {
      if (
        !hasUnsavedChanges() ||
        (await confirm({
          title: t('sharedUnsavedTitle'),
          message: t('sharedUnsavedMessage'),
          confirmLabel: t('sharedUnsavedLeave'),
          cancelLabel: t('sharedUnsavedStay'),
        }))
      ) {
        discardUnsavedChanges();
        leave();
      }
    },
    [confirm, t],
  );

// A form's changes since it was loaded: `value` is everything the form edits, `ready` says it
// has loaded. Registers the unsaved changes and returns whether there are any.
export const useFormChanges = (value, ready) => {
  const [snapshot, setSnapshot] = useState(null);
  const current = ready ? JSON.stringify(value) : null;
  if (ready && snapshot === null) {
    setSnapshot(current);
  }
  const dirty = Boolean(ready && snapshot !== null && current !== snapshot);
  useUnsavedChanges(dirty);
  return dirty;
};
