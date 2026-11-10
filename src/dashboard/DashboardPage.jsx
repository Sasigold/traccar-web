import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { keyframes } from 'tss-react';
import usePersistedState from '../common/util/usePersistedState';
import TvHeader from './components/TvHeader';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import FleetSetupCard from '../fleet/components/FleetSetupCard';
import PageLayout from '../common/components/PageLayout';
import EmptyState from '../common/components/table/EmptyState';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAdministrator, useRestriction } from '../common/util/permissions';
import useFeatures from '../common/util/useFeatures';
import { useFleetStatus } from '../common/fleet/useFleet';
import { devicesActions, messagesActions } from '../store';
import { DashboardDataProvider } from './data/DashboardDataContext';
import VehiclePeriodDialog from './components/VehiclePeriodDialog';
import { periodRange } from './data/periods';
import DashboardCanvas from './layout/DashboardCanvas';
import { HEIGHT_PRESETS, locate, uid } from './layout/model';
import {
  duplicateWidget,
  insertWidget,
  moveBy,
  moveWidget,
  ownRow,
  removeWidget,
  setCellWidth,
  setWidgetHeight,
} from './layout/operations';
import { minOfFor, normalizeDashboard, normalizeWidget, sizeOfFor } from './model/schema';
import { templateCoverage } from './model/templates';
import useDashboards from './model/useDashboards';
import { presetAvailable, presetOf } from './widgets/catalog';
import DashboardTabs, { NameDialog, dashboardName } from './components/DashboardTabs';
import DashboardFilterBar from './components/DashboardFilterBar';
import CatalogDrawer from './components/CatalogDrawer';
import WidgetSettingsDialog from './components/WidgetSettingsDialog';
import FocusDialog from './components/FocusDialog';
import DrillDialog from './components/DrillDialog';

// REP-20: a fade between boards on the control-room screen.
const boardIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const useStyles = makeStyles()((theme) => ({
  setup: {
    margin: theme.spacing(0, 3, 2),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 2, 2),
    },
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    backgroundColor: theme.palette.background.default,
  },
  tv: {
    padding: theme.spacing(2, 3),
    overflowY: 'auto',
    height: '100%',
  },
  // A kiosk (?tv=1) covers the app around it, as full screen would.
  kiosk: {
    position: 'fixed',
    inset: 0,
    zIndex: theme.zIndex.modal - 1,
  },
  board: {
    animation: `${boardIn} ${theme.tokens.motion.duration.enter}ms ${theme.tokens.motion.easing.standard}`,
    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  },
  top: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    padding: theme.spacing(0, 3, 1.5),
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.down('md')]: {
      position: 'static',
      padding: theme.spacing(1, 1.5, 1.25),
    },
  },
  body: {
    padding: theme.spacing(0.5, 3, 4),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0.5, 1.5, 3),
    },
  },
  editBar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.surface.textSecondaryOnTint,
    ...theme.typography.body2,
  },
  editHint: {
    flex: 1,
    minWidth: 200,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  tvExit: {
    position: 'fixed',
    insetInlineEnd: theme.spacing(2),
    bottom: theme.spacing(2),
    zIndex: 10,
    opacity: 0.4,
    '&:hover': {
      opacity: 1,
    },
  },
}));

const DashboardPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const admin = useAdministrator();
  const disableReports = useRestriction('disableReports');
  const features = useFeatures();
  const fleetStatus = useFleetStatus();
  const permissions = useSelector((state) => state.fleet.permissions);

  // Stable gates hide a widget; a fleet database that is still connecting (or failed)
  // keeps it on the board with a notice.
  const gates = useMemo(
    () => ({
      reports: !disableReports,
      features,
      fleet: (permission) =>
        fleetStatus === 'ready' ? permissions.includes(permission) : fleetStatus !== 'disabled',
    }),
    [disableReports, features, fleetStatus, permissions],
  );
  const available = useCallback((preset) => presetAvailable(preset, gates), [gates]);

  const store = useDashboards({ available });
  const { doc, editing } = store;

  // ─── TV mode ─────────────────────────────────────────────────────────────
  // REP-20: full screen where the browser can, or ?tv=1 for a kiosk (and for an iPhone, which
  // has no full screen for pages).
  const rootRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const kiosk = searchParams.get('tv') === '1';
  const [fullscreen, setFullscreen] = useState(false);
  const tv = fullscreen || kiosk;
  const [tvIndex, setTvIndex] = useState(0);
  const [tvRotation, setTvRotation] = usePersistedState('dashboardTvRotation', 60);
  useEffect(() => {
    const onChange = () =>
      setFullscreen(document.fullscreenElement === rootRef.current && Boolean(rootRef.current));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    if (!tv || doc.dashboards.length < 2) {
      return undefined;
    }
    const interval = setInterval(
      () => setTvIndex((index) => (index + 1) % doc.dashboards.length),
      tvRotation * 1000,
    );
    return () => clearInterval(interval);
  }, [tv, doc.dashboards.length, tvRotation]);
  // The screen of a control room should not go dark while it shows the board.
  useEffect(() => {
    if (!tv || !navigator.wakeLock?.request) return undefined;
    let lock = null;
    let released = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        lock = null;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release?.().catch(() => {});
    };
  }, [tv]);

  const dashboard = tv ? (doc.dashboards[tvIndex] ?? store.active) : store.active;
  const minOf = useMemo(() => minOfFor(dashboard.widgets), [dashboard.widgets]);

  // Widgets the user can no longer see (a permission was removed) close up in view mode.
  const rows = useMemo(() => {
    if (editing) {
      return dashboard.rows;
    }
    let result = dashboard.rows;
    Object.entries(dashboard.widgets).forEach(([id, config]) => {
      if (!available(presetOf(config.preset))) {
        result = removeWidget(result, id, minOf);
      }
    });
    return result;
  }, [editing, dashboard, available, minOf]);

  // ─── dialogs ─────────────────────────────────────────────────────────────
  const [catalog, setCatalog] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [drill, setDrill] = useState(null);
  const [vehiclePeriod, setVehiclePeriod] = useState(null);
  const devicesRef = useRef({});
  devicesRef.current = useSelector((state) => state.devices.items);
  const [highlightId, setHighlightId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [naming, setNaming] = useState(null); // 'rename' | 'duplicate'
  const [confirm, setConfirm] = useState(null); // 'delete' | 'reset' | 'publish'

  useEffect(() => {
    if (!highlightId) {
      return undefined;
    }
    const element = document.querySelector(`[data-widget-id="${highlightId}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const timeout = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(timeout);
  }, [highlightId]);

  // ─── layout changes ──────────────────────────────────────────────────────
  const { update } = store;
  const updateRows = useCallback(
    (change) =>
      update((current) => ({
        ...current,
        rows: change(current.rows, minOfFor(current.widgets), sizeOfFor(current.widgets)),
      })),
    [update],
  );

  const addWidget = useCallback(
    (presetId) => {
      const id = uid('w');
      update((current) => {
        const widgets = { ...current.widgets, [id]: { preset: presetId } };
        return {
          ...current,
          widgets,
          rows: insertWidget(
            current.rows,
            id,
            { kind: 'append' },
            sizeOfFor(widgets),
            minOfFor(widgets),
          ),
        };
      });
      setHighlightId(id);
    },
    [update],
  );

  const openDevice = useCallback(
    (deviceId) => {
      dispatch(devicesActions.selectId(deviceId));
      navigate('/');
    },
    [dispatch, navigate],
  );

  const api = useMemo(
    () => ({
      onSettings: setSettingsId,
      onFocusView: setFocusId,
      onRemove: (id) =>
        update((current) => {
          const widgets = { ...current.widgets };
          const next = removeWidget(current.rows, id, minOfFor(current.widgets));
          delete widgets[id];
          return { ...current, rows: next, widgets };
        }),
      onDuplicate: (id) => {
        const copyId = uid('w');
        update((current) => {
          const widgets = { ...current.widgets, [copyId]: { ...current.widgets[id] } };
          return {
            ...current,
            widgets,
            rows: duplicateWidget(current.rows, id, copyId, sizeOfFor(widgets), minOfFor(widgets)),
          };
        });
        setHighlightId(copyId);
      },
      onWidth: (id, width) => updateRows((current, mins) => setCellWidth(current, id, width, mins)),
      onHeight: (id, height) =>
        updateRows((current, mins) => setWidgetHeight(current, id, height, mins)),
      onMoveBy: (id, step) => updateRows((current, mins) => moveBy(current, id, step, mins)),
      onOwnRow: (id) => updateRows((current, mins, sizes) => ownRow(current, id, sizes, mins)),
      onMove: (id, target) =>
        updateRows((current, mins, sizes) => moveWidget(current, id, target, sizes, mins)),
      onViz: (id, viz) =>
        update((current) =>
          normalizeDashboard({
            ...current,
            widgets: { ...current.widgets, [id]: { ...current.widgets[id], viz } },
          }),
        ),
      onSelectItem: (id, item, query) => {
        if (query.d === 'vehicle' && !item.other) {
          if (!query.ds || query.ds === 'live') {
            openDevice(item.key);
          } else {
            // REP-07: a period chart: the vehicle's trips or replay in that period, or now.
            const range = periodRange(dashboard.filters.period, dayjs(), dashboard.filters);
            setVehiclePeriod({
              deviceId: Number(item.key),
              name: item.label || devicesRef.current[item.key]?.name || String(item.key),
              from: range.from,
              to: range.to,
            });
          }
        } else if (query.ds === 'live') {
          setDrill({ item, query });
        }
      },
      widthOf: (id) => locate(dashboard.rows, id)?.cell.w,
      heightPresetOf: (id) => {
        const at = locate(dashboard.rows, id);
        return (
          Object.keys(HEIGHT_PRESETS).find((key) => HEIGHT_PRESETS[key] === at?.item.h) ?? null
        );
      },
    }),
    [update, updateRows, openDevice, dashboard.rows, dashboard.filters],
  );

  const onRows = useCallback(
    (next, options) => {
      if (options.preview) {
        store.preview(next);
      } else if (options.commit && next == null) {
        store.commitPreview();
      } else if (options.commit) {
        update((current) => ({ ...current, rows: next }));
      }
    },
    [store, update],
  );

  // Undo / redo from the keyboard while editing.
  useEffect(() => {
    if (!editing) {
      return undefined;
    }
    const onKey = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
        return;
      }
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        store.undo();
      } else if (
        (event.key.toLowerCase() === 'z' && event.shiftKey) ||
        event.key.toLowerCase() === 'y'
      ) {
        event.preventDefault();
        store.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, store]);

  const singletonsUsed = useMemo(
    () =>
      new Set(
        Object.values(dashboard.widgets)
          .map((widget) => widget.preset)
          .filter((id) => presetOf(id)?.singleton),
      ),
    [dashboard.widgets],
  );
  const availability = useCallback(
    (preset) => {
      if (preset.gate?.reports && !gates.reports) {
        return 'dashboardNeedsReports';
      }
      if (preset.gate?.feature && gates.features?.[preset.gate.feature]) {
        return 'dashboardFeatureOff';
      }
      if (preset.gate?.fleet) {
        if (fleetStatus === 'disabled') {
          return 'fleetDatabaseDisabled';
        }
        if (fleetStatus === 'ready' && !permissions.includes(preset.gate.fleet)) {
          return 'fleetNoAccess';
        }
      }
      return null;
    },
    [gates, fleetStatus, permissions],
  );

  const enterTv = () => {
    setTvIndex(
      Math.max(
        0,
        doc.dashboards.findIndex((item) => item.id === doc.activeId),
      ),
    );
    if (document.fullscreenEnabled && rootRef.current?.requestFullscreen) {
      rootRef.current.requestFullscreen();
    } else {
      setSearchParams({ tv: '1' });
    }
  };
  const exitTv = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    if (kiosk) setSearchParams({});
  };

  // ─── header ──────────────────────────────────────────────────────────────
  const actions = editing ? (
    <div className={classes.actions}>
      {desktop && (
        <>
          <Tooltip title={t('dashboardUndo')}>
            <span>
              <IconButton
                aria-label={t('dashboardUndo')}
                disabled={!store.canUndo}
                onClick={store.undo}
              >
                <UndoRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('dashboardRedo')}>
            <span>
              <IconButton
                aria-label={t('dashboardRedo')}
                disabled={!store.canRedo}
                onClick={store.redo}
              >
                <RedoRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
      <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setCatalog(true)}>
        {t('dashboardAddWidget')}
      </Button>
      {desktop && <Button onClick={store.cancelEdit}>{t('sharedCancel')}</Button>}
      <Button variant="contained" startIcon={<CheckRoundedIcon />} onClick={store.finishEdit}>
        {t('dashboardDone')}
      </Button>
    </div>
  ) : (
    <div className={classes.actions}>
      <Button variant="contained" startIcon={<TuneRoundedIcon />} onClick={store.startEdit}>
        {t('dashboardCustomize')}
      </Button>
      <IconButton
        aria-label={t('dashboardMore')}
        aria-haspopup="menu"
        onClick={(event) => setMenuAnchor(event.currentTarget)}
      >
        <MoreVertRoundedIcon />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setNaming('rename');
          }}
        >
          <ListItemIcon>
            <EditRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('dashboardRename')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setNaming('duplicate');
          }}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('dashboardDuplicateDashboard')}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={doc.dashboards.length < 2}
          onClick={() => {
            setMenuAnchor(null);
            setConfirm('delete');
          }}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('dashboardDelete')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setConfirm('reset');
          }}
        >
          <ListItemIcon>
            <RestartAltRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {store.hasOrgDefault ? t('dashboardResetOrg') : t('dashboardReset')}
          </ListItemText>
        </MenuItem>
        {admin && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setConfirm('publish');
            }}
          >
            <ListItemIcon>
              <PublishRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('dashboardPublish')}</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            enterTv();
          }}
        >
          <ListItemIcon>
            <TvRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('dashboardTvMode')}</ListItemText>
        </MenuItem>
      </Menu>
    </div>
  );

  const setFilters = (filters) =>
    update((current) => normalizeDashboard({ ...current, filters }), { history: false });
  const setRefresh = (refresh) =>
    update((current) => ({ ...current, refresh }), { history: false });

  const content = (
    <DashboardDataProvider
      filters={dashboard.filters}
      onFilters={tv ? undefined : setFilters}
      refresh={tv ? dashboard.refresh || 300 : dashboard.refresh}
    >
      <div
        ref={rootRef}
        className={
          tv ? `${classes.root} ${classes.tv} ${kiosk ? classes.kiosk : ''}` : classes.root
        }
      >
        {!tv && (
          <div className={classes.top}>
            <DashboardTabs
              doc={doc}
              activeId={dashboard.id}
              disabled={editing}
              onSelect={store.select}
              onAdd={(template, name) => {
                store.add(template, name);
                if (!template) {
                  store.startEdit();
                }
              }}
              templateAvailable={(key) => templateCoverage(key, available) >= 0.5}
            />
            <DashboardFilterBar
              filters={dashboard.filters}
              refresh={dashboard.refresh}
              onFilters={setFilters}
              onRefresh={setRefresh}
            />
            {editing && (
              <div className={classes.editBar} role="status">
                <span className={classes.editHint}>
                  {desktop ? t('dashboardEditHint') : t('dashboardEditHintMobile')}
                </span>
              </div>
            )}
          </div>
        )}
        {tv && (
          <TvHeader
            dashboard={dashboard}
            rotation={tvRotation}
            onRotation={setTvRotation}
            rotating={doc.dashboards.length > 1}
          />
        )}
        <div key={tv ? dashboard.id : 'board'} className={tv ? classes.board : classes.body}>
          {rows.length ? (
            <DashboardCanvas
              rows={rows}
              widgets={dashboard.widgets}
              editing={editing}
              api={api}
              onRows={onRows}
              highlightId={highlightId}
            />
          ) : (
            <EmptyState
              icon={<SpaceDashboardRoundedIcon />}
              title={t('dashboardEmpty')}
              description={t('dashboardEmptyDescription')}
              action={
                <Button
                  variant="contained"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => {
                    if (!editing) {
                      store.startEdit();
                    }
                    setCatalog(true);
                  }}
                >
                  {t('dashboardAddWidget')}
                </Button>
              }
            />
          )}
        </div>
        {tv && (
          <IconButton className={classes.tvExit} aria-label={t('dashboardExitTv')} onClick={exitTv}>
            <FullscreenExitRoundedIcon />
          </IconButton>
        )}
      </div>
      <CatalogDrawer
        open={catalog}
        onClose={() => setCatalog(false)}
        onAdd={addWidget}
        availability={availability}
        singletonsUsed={singletonsUsed}
      />
      <WidgetSettingsDialog
        open={Boolean(settingsId)}
        config={settingsId ? dashboard.widgets[settingsId] : null}
        onClose={() => setSettingsId(null)}
        onSave={(config) => {
          const id = settingsId;
          const widget = normalizeWidget(config);
          update((current) =>
            normalizeDashboard({ ...current, widgets: { ...current.widgets, [id]: widget } }),
          );
          setSettingsId(null);
        }}
      />
      <FocusDialog
        config={focusId ? dashboard.widgets[focusId] : null}
        onClose={() => setFocusId(null)}
      />
      <DrillDialog drill={drill} onClose={() => setDrill(null)} />
      <VehiclePeriodDialog vehicle={vehiclePeriod} onClose={() => setVehiclePeriod(null)} />
    </DashboardDataProvider>
  );

  // REP-20: a kiosk shows only the board, without the page around it.
  if (kiosk) {
    return content;
  }

  return (
    <PageLayout
      title={t('dashboardTitle')}
      description={dashboardName(dashboard, t)}
      actions={actions}
    >
      <FleetSetupCard className={classes.setup} quiet />
      {content}
      <NameDialog
        open={Boolean(naming)}
        title={naming === 'rename' ? t('dashboardRename') : t('dashboardDuplicateDashboard')}
        initial={
          naming === 'rename' ? dashboardName(dashboard, t) : `${dashboardName(dashboard, t)} 2`
        }
        onClose={() => setNaming(null)}
        onSave={(name) => {
          if (naming === 'rename') {
            store.rename(dashboard.id, name);
          } else {
            store.duplicate(dashboard.id, name);
          }
          setNaming(null);
        }}
      />
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {confirm === 'delete' && t('dashboardDelete')}
          {confirm === 'reset' &&
            (store.hasOrgDefault ? t('dashboardResetOrg') : t('dashboardReset'))}
          {confirm === 'publish' && t('dashboardPublish')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirm === 'delete' &&
              t('dashboardDeleteConfirm').replace('{0}', dashboardName(dashboard, t))}
            {confirm === 'reset' && t('dashboardResetConfirm')}
            {confirm === 'publish' && t('dashboardPublishConfirm')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>{t('sharedCancel')}</Button>
          <Button
            variant="contained"
            color={confirm === 'delete' ? 'error' : 'primary'}
            onClick={async () => {
              const action = confirm;
              setConfirm(null);
              if (action === 'delete') {
                store.remove(dashboard.id);
              } else if (action === 'reset') {
                store.reset();
              } else if (action === 'publish') {
                try {
                  await store.publishDefault();
                  dispatch(messagesActions.push(t('dashboardPublished')));
                } catch (error) {
                  dispatch(messagesActions.push(error.message));
                }
              }
            }}
          >
            {confirm === 'delete' ? t('sharedRemove') : t('dashboardConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
};

export default DashboardPage;
