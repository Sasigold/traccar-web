// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { messagesActions, sessionActions } from '../../store';
import { getFleetClient } from '../../common/fleet/client';
import { useFleetFeatures } from '../../common/fleet/features';
import { useFleetPermission, useFleetProfile, useFleetReady } from '../../common/fleet/useFleet';
import { useFleetQuery } from '../../common/data/fleetQuery';
import { uid } from '../layout/model';
import { ATTRIBUTE, DEFAULT_ATTRIBUTE, decode, encode, fitsRemote } from './codec';
import {
  publishDefaultDashboards,
  putServerAttribute,
  putUserAttribute,
  readDefaultDashboards,
  readOwnDashboards,
  saveOwnDashboards,
} from './remote';
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

const fromDefault = (org) => freshDoc(org.dashboards.map((dashboard) => copyDashboard(dashboard)));

// Seconds, as the wire form keeps them.
const seconds = (ms) => Math.round((ms || 0) / 1000);

// Which document to show first: an unsynced local change that is newer than the account
// copy, else the account copy (`web.dashboard`), else the browser copy, else the
// organization default, else the built-in Operations template. `personal` says whether it is
// the person's own (and so worth moving to the fleet database) or only a starting point.
const loadDoc = (user, server, available) => {
  const remote = decode(user?.attributes?.[ATTRIBUTE]);
  const local = readLocal(user?.id);
  if (local?.doc && local.pending && (!remote || local.doc.updatedAt > remote.updatedAt)) {
    return { doc: local.doc, personal: true };
  }
  if (remote) {
    return { doc: remote, personal: true };
  }
  if (local?.doc) {
    return { doc: local.doc, personal: true };
  }
  const org = decode(server?.attributes?.[DEFAULT_ATTRIBUTE]);
  if (org) {
    return { doc: fromDefault(org), personal: false };
  }
  return { doc: freshDoc([instantiateTemplate('operations', available)]), personal: false };
};

// The user's dashboards: load, edit on a draft with undo/redo, save (debounced) to the fleet
// database when it has dashboards, else to the Traccar account (ARC-09, see remote.js), and
// always to this browser.
const useDashboards = ({ available }) => {
  const dispatch = useDispatch();
  const t = useTranslation();
  const store = useStore();
  const user = useSelector((state) => state.session.user);
  const server = useSelector((state) => state.session.server);
  const admin = Boolean(user?.administrator);
  const traccarWritable = Boolean(user && (admin || (!user.readonly && !server?.readonly)));

  // ARC-09: the fleet database keeps the dashboards once it has the area (not while unknown).
  const fleetReady = useFleetReady();
  const features = useFleetFeatures();
  const profile = useFleetProfile();
  const fleetMode = Boolean(fleetReady && profile?.id && features?.includes('dashboards'));
  const canPublishFleet = useFleetPermission('users.manage');
  const ownQuery = useFleetQuery(
    'dashboards',
    [profile?.id],
    (client) => readOwnDashboards(client, profile?.id),
    { enabled: fleetMode },
  );
  const defaultQuery = useFleetQuery('dashboard_defaults', [], readDefaultDashboards, {
    enabled: fleetMode,
  });
  // undefined while not known; null when the person has no row yet.
  const fleetOwn = useMemo(() => {
    if (!fleetMode || !ownQuery.isSuccess) return undefined;
    return decode(ownQuery.data?.[0]?.doc) ?? null;
  }, [fleetMode, ownQuery.isSuccess, ownQuery.data]);
  const fleetDefault = useMemo(
    () => (fleetMode ? decode(defaultQuery.data?.[0]?.doc) : null),
    [fleetMode, defaultQuery.data],
  );
  const serverDefault = useMemo(() => decode(server?.attributes?.[DEFAULT_ATTRIBUTE]), [server]);
  const orgDefault = fleetDefault ?? serverDefault;

  const canRemote = fleetMode || traccarWritable;
  const canPublish = fleetMode ? canPublishFleet : admin;

  const [initial] = useState(() => loadDoc(user, server, available));
  const [doc, setDoc] = useState(initial.doc);
  const [edit, setEdit] = useState(null); // { draft, past, future, base }
  const [saveState, setSaveState] = useState('saved'); // saved | saving | local | error
  const docRef = useRef(doc);
  docRef.current = doc;
  // Whether the shown document is the person's own (not just the default they started from).
  const personalRef = useRef(initial.personal);
  // A change that is not in the account yet (the timer runs, or the request is out).
  const pendingRef = useRef(false);
  const timerRef = useRef(null);
  const warnedRef = useRef(false);
  const remoteRef = useRef({});
  remoteRef.current = {
    fleetMode,
    orgId: profile?.org_id,
    profileId: profile?.id,
    traccarWritable,
  };

  // The Traccar copy is no longer needed once the fleet database has the document.
  const movedRef = useRef(false);
  const dropTraccarCopy = useCallback(async () => {
    const latest = store.getState().session.user;
    if (movedRef.current || !latest || latest.attributes?.[ATTRIBUTE] === undefined) return;
    if (!remoteRef.current.traccarWritable) return;
    movedRef.current = true;
    try {
      const updated = await putUserAttribute(latest.id, ATTRIBUTE, undefined);
      dispatch(sessionActions.updateUser(updated));
    } catch {
      movedRef.current = false;
    }
  }, [dispatch, store]);

  const sendRemote = useCallback(async () => {
    timerRef.current = null;
    const latest = store.getState().session.user;
    if (!latest) {
      return;
    }
    const sent = docRef.current;
    const encoded = encode(sent);
    const done = () => {
      if (docRef.current === sent) {
        pendingRef.current = false;
        writeLocal(latest.id, sent, false);
        setSaveState('saved');
      }
    };
    const { fleetMode: toFleet, orgId, profileId } = remoteRef.current;
    if (toFleet) {
      setSaveState('saving');
      try {
        await saveOwnDashboards(getFleetClient(), { orgId, profileId }, encoded);
        done();
        dropTraccarCopy();
      } catch {
        setSaveState('error');
      }
      return;
    }
    const tooBig = () => {
      setSaveState('local');
      if (!warnedRef.current) {
        warnedRef.current = true;
        dispatch(messagesActions.push(t('dashboardSavedLocally')));
      }
    };
    if (!fitsRemote(encoded, latest.attributes)) {
      tooBig();
      return;
    }
    setSaveState('saving');
    try {
      // The latest user, with only this attribute changed (checked again against it).
      const updated = await putUserAttribute(latest.id, ATTRIBUTE, encoded, (fresh) =>
        fitsRemote(encoded, fresh.attributes),
      );
      if (!updated) {
        tooBig();
        return;
      }
      dispatch(sessionActions.updateUser(updated));
      done();
    } catch {
      setSaveState('error');
    }
  }, [dispatch, dropTraccarCopy, store, t]);

  const persist = useCallback(
    (next) => {
      const stamped = { ...next, updatedAt: Date.now() };
      docRef.current = stamped;
      personalRef.current = true;
      setDoc(stamped);
      writeLocal(user?.id, stamped, canRemote);
      if (canRemote) {
        pendingRef.current = true;
        setSaveState('saving');
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(sendRemote, SAVE_DELAY);
      } else {
        setSaveState('local');
      }
    },
    [user?.id, canRemote, sendRemote],
  );

  // ARC-09: the fleet copy arrived (or came back newer, from another device). Show it unless a
  // change here is newer; move this browser's or Traccar's copy over when the fleet has none;
  // start from the organization default when there is nothing of the person's own.
  useEffect(() => {
    if (fleetOwn === undefined || edit || pendingRef.current) {
      return;
    }
    const current = docRef.current;
    const schedule = () => {
      pendingRef.current = true;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sendRemote, SAVE_DELAY);
    };
    if (fleetOwn) {
      if (seconds(fleetOwn.updatedAt) > seconds(current.updatedAt) || !personalRef.current) {
        if (encode(fleetOwn) !== encode(current)) {
          docRef.current = fleetOwn;
          setDoc(fleetOwn);
        }
        personalRef.current = true;
        writeLocal(user?.id, fleetOwn, false);
      } else if (seconds(current.updatedAt) > seconds(fleetOwn.updatedAt)) {
        schedule();
      } else {
        dropTraccarCopy();
      }
    } else if (personalRef.current) {
      schedule();
    } else if (fleetDefault) {
      const next = fromDefault(fleetDefault);
      docRef.current = next;
      setDoc(next);
    }
  }, [fleetOwn, fleetDefault, edit, sendRemote, dropTraccarCopy, user?.id]);

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

  // The organization default: a row of the fleet database, or (without it) the one server
  // attribute, merged into the latest server settings (ARC-09).
  const publishDefault = useCallback(async () => {
    const current = docRef.current.dashboards.find((item) => item.id === docRef.current.activeId);
    const encoded = encode({
      v: VERSION,
      activeId: current.id,
      updatedAt: Date.now(),
      dashboards: [current],
    });
    const { fleetMode: toFleet, orgId } = remoteRef.current;
    if (toFleet) {
      await publishDefaultDashboards(getFleetClient(), orgId, encoded);
    } else {
      dispatch(sessionActions.updateServer(await putServerAttribute(DEFAULT_ATTRIBUTE, encoded)));
    }
  }, [dispatch]);

  return {
    doc,
    active,
    editing: Boolean(edit),
    canUndo: Boolean(edit?.past.length),
    canRedo: Boolean(edit?.future.length),
    saveState,
    canRemote,
    canPublish,
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
