import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAttributePreference } from '../util/preferences';
import usePersistedState from '../util/usePersistedState';
import fetchOrThrow from '../util/fetchOrThrow';
import { messagesActions, sessionActions } from '../../store';
import { surfaces } from './tokens';

// Light mode is the default. A user attribute (darkMode) wins when it is set,
// otherwise the locally persisted choice applies. Readonly users (and users
// that are not logged in yet) only get the local choice.
export default () => {
  const dispatch = useDispatch();

  const user = useSelector((state) => state.session.user);
  const server = useSelector((state) => state.session.server);

  const remote = useAttributePreference('darkMode', null);
  const [local, setLocal] = usePersistedState('themeMode', null);

  const dark = remote != null ? Boolean(remote) : local === 'dark';
  const forced = Boolean(server?.forceSettings && server?.attributes?.darkMode != null);
  const canPersistRemote = Boolean(
    user && (user.administrator || (!user.readonly && !server?.readonly)),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = dark ? surfaces.dark.canvas : surfaces.light.canvas;
    }
  }, [dark]);

  const setMode = useCallback(
    async (mode) => {
      const next = mode === 'dark';
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
    () => ({ dark, mode: dark ? 'dark' : 'light', forced, toggle, setMode }),
    [dark, forced, toggle, setMode],
  );
};
