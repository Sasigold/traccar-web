// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAttributePreference } from '../util/preferences';
import usePersistedState from '../util/usePersistedState';
import fetchOrThrow from '../util/fetchOrThrow';
import { messagesActions, sessionActions } from '../../store';
import { chrome } from './tokens';

// Light mode is the default. A user attribute (darkMode) wins when it is set,
// otherwise the locally persisted choice applies. Readonly users (and users
// that are not logged in yet) only get the local choice.
// BRD-07: the choice is light, dark or 'system' (follows prefers-color-scheme, live).
const systemQuery = '(prefers-color-scheme: dark)';
const systemDark = () => Boolean(window.matchMedia?.(systemQuery).matches);

export const choiceOf = (remote, local) => {
  if (remote === 'system') return 'system';
  if (remote != null) return remote === true || remote === 'true' ? 'dark' : 'light';
  return ['light', 'dark', 'system'].includes(local) ? local : 'light';
};
export default () => {
  const dispatch = useDispatch();

  const user = useSelector((state) => state.session.user);
  const server = useSelector((state) => state.session.server);

  const remote = useAttributePreference('darkMode', null);
  const [local, setLocal] = usePersistedState('themeMode', null);

  const choice = choiceOf(remote, local);
  const [osDark, setOsDark] = useState(systemDark);
  useEffect(() => {
    const query = window.matchMedia?.(systemQuery);
    if (!query) return undefined;
    const onChange = () => setOsDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const dark = choice === 'system' ? osDark : choice === 'dark';
  const forced = Boolean(server?.forceSettings && server?.attributes?.darkMode != null);
  const canPersistRemote = Boolean(
    user && (user.administrator || (!user.readonly && !server?.readonly)),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    // BRD-06 (BRAND.md §7): the browser and status bar are navy in both modes, like the rail.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = chrome.background;
    }
  }, [dark]);

  const setMode = useCallback(
    async (mode) => {
      const next = mode === 'system' ? 'system' : mode === 'dark';
      const root = document.documentElement;
      root.classList.add('theme-switching');
      window.setTimeout(() => root.classList.remove('theme-switching'), 300);
      setLocal(mode);
      if (canPersistRemote) {
        try {
          const response = await fetchOrThrow(`api/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...user, attributes: { ...user.attributes, darkMode: next } }),
          });
          dispatch(sessionActions.updateUser(await response.json()));
        } catch (error) {
          dispatch(messagesActions.push(error.message));
        }
      }
    },
    [canPersistRemote, dispatch, setLocal, user],
  );

  const toggle = useCallback(() => setMode(dark ? 'light' : 'dark'), [dark, setMode]);

  return useMemo(
    () => ({ dark, mode: dark ? 'dark' : 'light', choice, forced, toggle, setMode }),
    [dark, choice, forced, toggle, setMode],
  );
};
