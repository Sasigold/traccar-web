import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { messagesActions, sessionActions } from '../../store';
import { uid } from '../layout/model';
import { ATTRIBUTE, DEFAULT_ATTRIBUTE, decode, encode, fitsRemote } from './codec';
import { VERSION, normalizeDashboard } from './schema';
import { emptyDashboard, instantiateTemplate } from './templates';

const SAVE_DELAY = 1200;
const HISTORY = 50;

const localKey = (userId) => `dashboard:${userId ?? 'guest'}`;

const readLocal = (userId) => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(localKey(userId)) ?? 'null');
    return stored ? { doc: decode(stored.doc), pending: Boolean(stored.pending) } : null;
  } catch {
    return null;
  }
};

const writeLocal = (userId, doc, pending) => {
  try {
    window.localStorage.setItem(localKey(userId), JSON.stringify({ doc: encode(doc), pending }));
  } catch {
    // Storage full or blocked: the layout still lives in memory for this visit.
  }
};

const freshDoc = (dashboards) => ({
  v: VERSION,
  activeId: dashboards[0].id,
  updatedAt: 0,
  dashboards,
});

// Copies a dashboard with new ids (organization default, duplicates).
const copyDashboard = (dashboard, patch = {}) =>
  normalizeDashboard({ ...dashboard, id: uid('d'), ...patch });

// Which document to show: an unsynced local change that is newer than the account
// copy, else the account copy (`web.dashboard`), else the browser copy, else the
// organization default, else the built-in Operations template.
const loadDoc = (user, server, available) => {
  const remote = decode(user?.attributes?.[ATTRIBUTE]);
  const local = readLocal(user?.id);
  if (local?.doc && local.pending && (!remote || local.doc.updatedAt > remote.updatedAt)) {
    return local.doc;
  }
  if (remote) {
    return remote;
  }
  if (local?.doc) {
    return local.doc;
  }
  const org = decode(server?.attributes?.[DEFAULT_ATTRIBUTE]);
  if (org) {
    return freshDoc(org.dashboards.map((dashboard) => copyDashboard(dashboard)));
  }
  return freshDoc([instantiateTemplate('operations', available)]);
};

// The user's dashboards: load, edit on a draft with undo/redo, save to the account
// (debounced, merged into the latest user object) and always to this browser.
const useDashboards = ({ available }) => {
  const dispatch = useDispatch();
  const t = useTranslation();
  const store = useStore();
  const user = useSelector((state) => state.session.user);
  const server = useSelector((state) => state.session.server);
  const canRemote = Boolean(user && (user.administrator || (!user.readonly && !server?.readonly)));
  const orgDefault = useMemo(() => decode(server?.attributes?.[DEFAULT_ATTRIBUTE]), [server]);

  const [doc, setDoc] = useState(() => loadDoc(user, server, available));
  const [edit, setEdit] = useState(null); // { draft, past, future, base }
  const [saveState, setSaveState] = useState('saved'); // saved | saving | local | error
  const docRef = useRef(doc);
  docRef.current = doc;
  const timerRef = useRef(null);
  const warnedRef = useRef(false);

  const sendRemote = useCallback(async () => {
    timerRef.current = null;
    const latest = store.getState().session.user;
    if (!latest) {
      return;
    }
    const encoded = encode(docRef.current);
    if (!fitsRemote(encoded, latest.attributes)) {
      setSaveState('local');
      if (!warnedRef.current) {
        warnedRef.current = true;
        dispatch(messagesActions.push(t('dashboardSavedLocally')));
      }
      return;
    }
    setSaveState('saving');
    try {
      const response = await fetchOrThrow(`api/users/${latest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...latest,
          attributes: { ...latest.attributes, [ATTRIBUTE]: encoded },
        }),
      });
      dispatch(sessionActions.updateUser(await response.json()));
      writeLocal(latest.id, docRef.current, false);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [dispatch, store, t]);

  const persist = useCallback(
    (next) => {
      const stamped = { ...next, updatedAt: Date.now() };
      docRef.current = stamped;
      setDoc(stamped);
      writeLocal(user?.id, stamped, canRemote);
      if (canRemote) {
        setSaveState('saving');
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(sendRemote, SAVE_DELAY);
      } else {
        setSaveState('local');
      }
    },
    [user?.id, canRemote, sendRemote],
  );

  // Flush a pending save when the tab is hidden or the page is left.
  useEffect(() => {
    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        sendRemote();
      }
    };
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [sendRemote]);

  const saved =
    doc.dashboards.find((dashboard) => dashboard.id === doc.activeId) ?? doc.dashboards[0];
  const active = edit ? edit.draft : saved;

  const replaceActive = useCallback(
    (dashboard) => ({
      ...docRef.current,
      dashboards: docRef.current.dashboards.map((item) =>
        item.id === dashboard.id ? dashboard : item,
      ),
    }),
    [],
  );

  // Changes to the shown dashboard: on the draft while editing, saved otherwise.
  const update = useCallback(
    (change, { history = true } = {}) => {
      if (edit) {
        setEdit((current) => {
          const draft = change(current.draft);
          if (draft === current.draft) {
            return current;
          }
          return history
            ? {
                ...current,
                draft,
                past: [...current.past, current.draft].slice(-HISTORY),
                future: [],
                base: null,
              }
            : { ...current, draft };
        });
      } else {
        const current = docRef.current.dashboards.find(
          (item) => item.id === docRef.current.activeId,
        );
        const next = change(current);
        if (next !== current) {
          persist(replaceActive(next));
        }
      }
    },
    [edit, persist, replaceActive],
  );

  // Live preview of a divider drag, then one history entry when it ends.
  const preview = useCallback((rows) => {
    setEdit((current) =>
      current
        ? { ...current, base: current.base ?? current.draft, draft: { ...current.draft, rows } }
        : current,
    );
  }, []);
  const commitPreview = useCallback(() => {
    setEdit((current) =>
      current?.base
        ? {
            ...current,
            past: [...current.past, current.base].slice(-HISTORY),
            future: [],
            base: null,
          }
        : current,
    );
  }, []);

  const startEdit = useCallback(() => {
    setEdit({ draft: saved, past: [], future: [], base: null });
  }, [saved]);
  const cancelEdit = useCallback(() => setEdit(null), []);
  const finishEdit = useCallback(() => {
    if (edit) {
      persist(replaceActive(edit.draft));
    }
    setEdit(null);
  }, [edit, persist, replaceActive]);
  const undo = useCallback(() => {
    setEdit((current) =>
      current?.past.length
        ? {
            ...current,
            draft: current.past.at(-1),
            past: current.past.slice(0, -1),
            future: [current.draft, ...current.future],
          }
        : current,
    );
  }, []);
  const redo = useCallback(() => {
    setEdit((current) =>
      current?.future.length
        ? {
            ...current,
            draft: current.future[0],
            past: [...current.past, current.draft],
            future: current.future.slice(1),
          }
        : current,
    );
  }, []);

  // ─── dashboards ──────────────────────────────────────────────────────────
  const select = useCallback(
    (id) => {
      if (!edit && id !== docRef.current.activeId) {
        persist({ ...docRef.current, activeId: id });
      }
    },
    [edit, persist],
  );

  const add = useCallback(
    (template, name) => {
      const dashboard = template ? instantiateTemplate(template, available) : emptyDashboard(name);
      persist({
        ...docRef.current,
        activeId: dashboard.id,
        dashboards: [...docRef.current.dashboards, dashboard],
      });
      return dashboard;
    },
    [available, persist],
  );

  const rename = useCallback(
    (id, name) => {
      persist({
        ...docRef.current,
        dashboards: docRef.current.dashboards.map((item) => {
          if (item.id !== id) {
            return item;
          }
          const { nameKey, ...rest } = item;
          void nameKey;
          return { ...rest, name: name.trim().slice(0, 40) };
        }),
      });
    },
    [persist],
  );

  const duplicate = useCallback(
    (id, name) => {
      const source = docRef.current.dashboards.find((item) => item.id === id);
      const copy = copyDashboard(source, { name, nameKey: undefined });
      persist({
        ...docRef.current,
        activeId: copy.id,
        dashboards: [...docRef.current.dashboards, copy],
      });
    },
    [persist],
  );

  // REP-19: a dashboard shared by link comes in as a copy of its own.
  const importCopy = useCallback(
    (dashboard) => {
      const copy = copyDashboard(dashboard);
      if (!copy) return null;
      persist({
        ...docRef.current,
        activeId: copy.id,
        dashboards: [...docRef.current.dashboards, copy],
      });
      return copy;
    },
    [persist],
  );

  const remove = useCallback(
    (id) => {
      const dashboards = docRef.current.dashboards.filter((item) => item.id !== id);
      if (!dashboards.length) {
        return;
      }
      persist({
        ...docRef.current,
        activeId: docRef.current.activeId === id ? dashboards[0].id : docRef.current.activeId,
        dashboards,
      });
    },
    [persist],
  );

  // Back to the organization default (or the built-in template it started from).
  const reset = useCallback(() => {
    const current = docRef.current.dashboards.find((item) => item.id === docRef.current.activeId);
    const source = orgDefault?.dashboards[0];
    const base = source
      ? copyDashboard(source, { id: current.id })
      : instantiateTemplate(
          { dashboardTplActivity: 'activity', dashboardTplMaintenance: 'maintenance' }[
            current.nameKey
          ] ?? 'operations',
          available,
        );
    const next = {
      ...base,
      id: current.id,
      name: current.name,
      nameKey: current.name ? undefined : base.nameKey,
    };
    setEdit(null);
    persist(replaceActive(normalizeDashboard(next)));
  }, [orgDefault, available, persist, replaceActive]);

  const publishDefault = useCallback(async () => {
    const latest = store.getState().session.server;
    const current = docRef.current.dashboards.find((item) => item.id === docRef.current.activeId);
    const encoded = encode({
      v: VERSION,
      activeId: current.id,
      updatedAt: Date.now(),
      dashboards: [current],
    });
    const response = await fetchOrThrow('api/server', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...latest,
        attributes: { ...latest.attributes, [DEFAULT_ATTRIBUTE]: encoded },
      }),
    });
    dispatch(sessionActions.updateServer(await response.json()));
  }, [dispatch, store]);

  return {
    doc,
    active,
    editing: Boolean(edit),
    canUndo: Boolean(edit?.past.length),
    canRedo: Boolean(edit?.future.length),
    saveState,
    canRemote,
    hasOrgDefault: Boolean(orgDefault),
    update,
    preview,
    commitPreview,
    startEdit,
    cancelEdit,
    finishEdit,
    undo,
    redo,
    select,
    add,
    rename,
    duplicate,
    importCopy,
    remove,
    reset,
    publishDefault,
  };
};

export default useDashboards;
