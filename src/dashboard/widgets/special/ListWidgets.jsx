import { useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { ButtonBase } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import BuildCircleRoundedIcon from '@mui/icons-material/BuildCircleRounded';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import EmptyState from '../../../common/components/table/EmptyState';
import { prefixString } from '../../../common/util/stringUtils';
import { devicesActions } from '../../../store';
import { useChartTheme } from '../../charts/chartTheme';
import SegmentedBar from '../../charts/SegmentedBar';
import TableView from '../../charts/TableView';
import { DIMENSIONS, sourceOf } from '../../data/datasets';
import { aggregate } from '../../data/aggregate';
import { useDashboardData } from '../../data/DashboardDataContext';
import { useLabels } from '../useLabels';
import { useSourceRows } from '../useWidgetModel';
import { WidgetState } from '../WidgetFrame';
import { MAINTENANCE_DEVICE_LIMIT } from '../../data/fleetSources';

const ROW = 44;

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  row: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minHeight: ROW - 2,
    padding: theme.spacing(0.5, 0.75),
    borderRadius: theme.tokens.radius.md,
    textAlign: 'start',
    '&:hover, &:focus-visible': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  primary: {
    ...theme.typography.body2,
    fontWeight: 600,
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  secondary: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  side: {
    ...theme.typography.caption,
    fontWeight: 600,
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  note: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
  },
}));

const ListRows = ({ rows, height, onOpen }) => {
  const { classes } = useStyles();
  const fit = Math.max(1, Math.floor(height / ROW));
  return (
    <ul className={classes.list}>
      {rows.slice(0, fit).map((row) => (
        <li key={row.key}>
          <ButtonBase className={classes.row} onClick={() => onOpen(row)} focusRipple>
            <span className={classes.dot} style={{ backgroundColor: row.color }} />
            <span className={classes.main}>
              <span className={classes.primary}>{row.primary}</span>
              {row.secondary && <span className={classes.secondary}>{row.secondary}</span>}
            </span>
            {row.side && (
              <span className={classes.side} dir="ltr">
                {row.side}
              </span>
            )}
          </ButtonBase>
        </li>
      ))}
    </ul>
  );
};

const useOpenDevice = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  return (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/');
  };
};

// Events since the app was opened (live from the server; capped at 50).
export const EventFeedWidget = ({ height }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const { deviceIds } = useDashboardData();
  const events = useSelector((state) => state.events.items);
  const devices = useSelector((state) => state.devices.items);
  const rows = useMemo(() => {
    const scope = new Set(deviceIds);
    return events
      .filter((event) => scope.has(event.deviceId))
      .map((event) => {
        const alarm = event.type === 'alarm' && event.attributes?.alarm;
        return {
          key: event.id,
          id: event.id,
          primary: alarm ? t(prefixString('alarm', alarm)) : t(prefixString('event', event.type)),
          secondary: devices[event.deviceId]?.name,
          side: dayjs(event.eventTime).format('HH:mm'),
          color:
            alarm || event.type === 'deviceOverspeed' ? chart.tone('error') : chart.tone('info'),
        };
      });
  }, [events, deviceIds, devices, t, chart]);
  if (!rows.length) {
    return (
      <EmptyState
        compact
        icon={<NotificationsNoneRoundedIcon />}
        title={t('dashboardNoEvents')}
        description={t('dashboardNoEventsDescription')}
      />
    );
  }
  return (
    <div className={classes.root}>
      <ListRows rows={rows} height={height} onOpen={(row) => navigate(`/event/${row.id}`)} />
    </div>
  );
};

const expiryTone = { expired: 'error', expiring: 'warning', valid: 'success' };

// Validity: expired / expiring soon / valid, and the nearest dates.
export const ExpiriesWidget = ({ width, height, size, table }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const { label } = useLabels();
  const { expiryRows } = useDashboardData();
  const counts = useMemo(
    () =>
      aggregate(expiryRows, {
        dimension: DIMENSIONS.expiryStatus,
        measure: { agg: 'count' },
      }),
    [expiryRows],
  );
  const view = useMemo(() => {
    const total = counts.total || 1;
    return {
      kind: 'categorical',
      items: counts.items.map((item) => ({
        key: item.key,
        label: label('expiryStatus', item.key),
        value: item.value,
        text: String(item.value),
        full: String(item.value),
        share: item.value / total,
        shareText: `${Math.round((item.value / total) * 100)}%`,
        color: chart.tone(expiryTone[item.key]),
      })),
      totalText: String(counts.total),
      summary: counts.items
        .map((item) => `${label('expiryStatus', item.key)}: ${item.value}`)
        .join(', '),
    };
  }, [counts, label, chart]);
  const urgent = expiryRows.filter((row) => row.status === 'expired' || row.status === 'expiring');
  const rows = urgent.map((row) => ({
    key: row.id,
    primary: row.plateNumber || row.name,
    secondary: t(row.labelKey),
    side:
      row.days < 0
        ? t('dashboardDaysAgo').replace('{0}', -row.days)
        : t('dashboardDaysLeft').replace('{0}', row.days),
    color: chart.tone(expiryTone[row.status]),
    row,
  }));
  if (!expiryRows.length) {
    return <EmptyState compact icon={<VerifiedRoundedIcon />} title={t('dashboardNoExpiries')} />;
  }
  if (table) {
    return (
      <TableView
        columns={[
          { key: 'name', label: t('sharedName') },
          { key: 'type', label: t('sharedType') },
          { key: 'days', label: t('dashboardDays'), numeric: true },
        ]}
        rows={expiryRows.map((row) => ({
          key: row.id,
          color: chart.tone(expiryTone[row.status] ?? 'neutral'),
          cells: {
            name: row.plateNumber || row.name,
            type: t(row.labelKey),
            days: String(row.days),
          },
        }))}
      />
    );
  }
  const barHeight = size === 'xs' ? 70 : 104;
  return (
    <div className={classes.root}>
      <div style={{ height: barHeight, flexShrink: 0 }}>
        <SegmentedBar
          view={view}
          width={width}
          height={barHeight}
          size={size === 'xs' ? 'xs' : 'sm'}
        />
      </div>
      {rows.length ? (
        <ListRows
          rows={rows}
          height={height - barHeight - 12}
          onOpen={() => navigate('/fleet/expiries')}
        />
      ) : (
        <span className={classes.note}>{t('dashboardAllValid')}</span>
      )}
    </div>
  );
};

const maintenanceTone = { overdue: 'error', due: 'warning', ok: 'success', unknown: 'neutral' };

// Maintenance due per vehicle (Traccar maintenance + latest positions).
export const MaintenanceWidget = ({ height, table }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const { deviceIds } = useDashboardData();
  const devices = useSelector((state) => state.devices.items);
  const range = useDashboardData().range;
  const data = useSourceRows('maintenance', sourceOf('maintenance'), range);
  if (data.status === 'loading') {
    return <WidgetState state="loading" />;
  }
  if (data.status !== 'success') {
    return <WidgetState state={data.status === 'tooLarge' ? 'tooLarge' : 'error'} />;
  }
  const rank = { overdue: 0, due: 1, ok: 2, unknown: 3 };
  const rows = [...data.data]
    .sort((a, b) => rank[a.maintenanceStatus] - rank[b.maintenanceStatus])
    .map((row) => ({
      key: `${row.deviceId}-${row.maintenance.id}`,
      primary: devices[row.deviceId]?.name ?? `#${row.deviceId}`,
      secondary: row.maintenance.name,
      side: t(
        `dashboardMaintenance${row.maintenanceStatus[0].toUpperCase()}${row.maintenanceStatus.slice(1)}`,
      ),
      color: chart.tone(maintenanceTone[row.maintenanceStatus]),
      status: row.maintenanceStatus,
    }));
  if (!rows.length) {
    return (
      <EmptyState compact icon={<BuildCircleRoundedIcon />} title={t('dashboardNoMaintenance')} />
    );
  }
  if (table) {
    return (
      <TableView
        columns={[
          { key: 'vehicle', label: t('sharedDevice') },
          { key: 'name', label: t('sharedName') },
          { key: 'status', label: t('deviceStatus') },
        ]}
        rows={rows.map((row) => ({
          key: row.key,
          color: row.color,
          cells: { vehicle: row.primary, name: row.secondary, status: row.side },
        }))}
      />
    );
  }
  return (
    <div className={classes.root}>
      <ListRows
        rows={rows}
        height={height - (deviceIds.length > MAINTENANCE_DEVICE_LIMIT ? 20 : 0)}
        onOpen={() => navigate('/settings/maintenances')}
      />
      {deviceIds.length > MAINTENANCE_DEVICE_LIMIT && (
        <span className={classes.note}>
          {t('dashboardMaintenanceLimited').replace('{0}', MAINTENANCE_DEVICE_LIMIT)}
        </span>
      )}
    </div>
  );
};

// Top vehicles for the period: distance, engine hours, max speed and fuel side by side.
export const TopVehiclesWidget = ({ width }) => {
  const t = useTranslation();
  const openDevice = useOpenDevice();
  const { range } = useDashboardData();
  const { format, label, unitLabel } = useLabels();
  const data = useSourceRows('summary', sourceOf('summary'), range);
  if (data.status === 'loading' || data.status === 'idle') {
    return <WidgetState state="loading" />;
  }
  if (data.status !== 'success') {
    return <WidgetState state={data.status === 'tooLarge' ? 'tooLarge' : 'error'} />;
  }
  const byDevice = new Map();
  data.data.forEach((row) => {
    const entry = byDevice.get(row.deviceId) ?? {
      deviceId: row.deviceId,
      distance: 0,
      engineHours: 0,
      maxSpeed: 0,
      spentFuel: 0,
    };
    entry.distance += row.distance || 0;
    entry.engineHours += row.engineHours || 0;
    entry.maxSpeed = Math.max(entry.maxSpeed, row.maxSpeed || 0);
    entry.spentFuel += row.spentFuel || 0;
    byDevice.set(row.deviceId, entry);
  });
  const rows = [...byDevice.values()].sort((a, b) => b.distance - a.distance);
  if (!rows.length) {
    return (
      <EmptyState compact title={t('dashboardNoData')} description={t('dashboardNoDataPeriod')} />
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TableView
        columns={[
          { key: 'vehicle', label: t('sharedDevice') },
          {
            key: 'distance',
            label: `${t('sharedDistance')} (${unitLabel('distance')})`,
            numeric: true,
          },
          ...(width >= 420 ? [{ key: 'hours', label: t('reportEngineHours'), numeric: true }] : []),
          {
            key: 'speed',
            label: `${t('reportMaximumSpeed')} (${unitLabel('speed')})`,
            numeric: true,
          },
          ...(width >= 560
            ? [
                {
                  key: 'fuel',
                  label: `${t('reportSpentFuel')} (${unitLabel('volume')})`,
                  numeric: true,
                },
              ]
            : []),
        ]}
        rows={rows.map((row) => ({
          key: row.deviceId,
          raw: row,
          cells: {
            vehicle: label('vehicle', row.deviceId),
            distance: format(row.distance, 'distance').text,
            hours: format(row.engineHours, 'duration', { compact: false }).text,
            speed: format(row.maxSpeed, 'speed').text,
            fuel: format(row.spentFuel, 'volume').text,
          },
        }))}
        onSelect={(row) => openDevice(row.deviceId)}
      />
    </div>
  );
};
