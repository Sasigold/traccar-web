import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink } from 'react-router-dom';
import { ButtonBase } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { makeStyles } from 'tss-react/mui';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import EmptyState from '../../../common/components/table/EmptyState';
import { formatDays } from '../../../common/util/plural';
import useFeatures from '../../../common/util/useFeatures';
import { getFleetClient, unwrap } from '../../../common/fleet/client';
import { useFleetPermission } from '../../../common/fleet/useFleet';
import TableView from '../../charts/TableView';
import { useChartTheme } from '../../charts/chartTheme';
import { sourceOf } from '../../data/datasets';
import { useCachedQuery, useDashboardData } from '../../data/DashboardDataContext';
import { LEVELS, attentionCounts, attentionItems } from '../../data/attention';
import { useSourceRows } from '../useWidgetModel';
import { WidgetState } from '../WidgetFrame';

const ROW = 52;
const SUMMARY = 28;
const MIN_COLUMN = 300;

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    minHeight: SUMMARY - 8,
    flexWrap: 'wrap',
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
  },
  count: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontWeight: 600,
  },
  more: {
    marginInlineStart: 'auto',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'grid',
    columnGap: theme.spacing(2),
    alignContent: 'start',
  },
  row: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minHeight: ROW - 4,
    padding: theme.spacing(0.5, 0.75),
    borderRadius: theme.tokens.radius.md,
    textAlign: 'start',
    color: 'inherit',
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
}));

const TONE = { critical: 'error', high: 'warning', medium: 'info' };
const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());
const ready = (data) => (data.status === 'success' ? data.data : []);

// Tickets that still have to be assigned to a driver (ISR-02), for the transfer deadline.
const loadViolations = async () =>
  unwrap(
    await getFleetClient()
      .from('driver_violations')
      .select('id, status, due_at, drivers(full_name), vehicles(plate_number, traccar_device_id)')
      .not('status', 'in', '(transferred,paid,closed)')
      .not('due_at', 'is', null)
      .limit(500),
  ) || [];

// What the reason of an item says, in plain words. A count of zero days reads "today".
const useDescribe = () => {
  const t = useTranslation();
  const days = (count) => formatDays(count, t);
  return (item) => {
    switch (item.kind) {
      case 'expiry': {
        const name = t(item.labelKey);
        if (item.days === 0) {
          return t('attentionExpiresToday').replace('{0}', name);
        }
        return t(item.days < 0 ? 'attentionExpired' : 'attentionExpiring')
          .replace('{0}', name)
          .replace('{1}', days(item.days));
      }
      case 'maintenance':
        return t(item.overdue ? 'attentionMaintenanceOverdue' : 'attentionMaintenanceDue').replace(
          '{0}',
          item.label,
        );
      case 'incident': {
        const type = t(`fleetIncidentType${capital(item.incidentType || 'other')}`);
        return item.days === 0
          ? t('attentionIncidentToday').replace('{0}', type)
          : t('attentionIncident').replace('{0}', type).replace('{1}', days(item.days));
      }
      case 'silent':
        return t('attentionSilent').replace(
          '{0}',
          item.hours < 48
            ? t('attentionHours').replace('{0}', item.hours)
            : days(Math.floor(item.hours / 24)),
        );
      case 'violation':
        if (item.days === 0) {
          return t('attentionViolationToday');
        }
        return t(item.days < 0 ? 'attentionViolationOverdue' : 'attentionViolationSoon').replace(
          '{0}',
          days(item.days),
        );
      default:
        return '';
    }
  };
};

// "Needs attention now" (REP-24): expired documents, overdue maintenance, open incidents, silent
// vehicles and tickets near their transfer deadline, in one list ranked by urgency.
const AttentionWidget = ({ width, height, table }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const chart = useChartTheme();
  const describe = useDescribe();
  const features = useFeatures();
  const devices = useSelector((state) => state.devices.items);
  const { liveRows, expiryRows, range, deviceIds } = useDashboardData();
  const maintenance = useSourceRows(
    'maintenance',
    sourceOf('maintenance'),
    range,
    !features.disableMaintenance,
  );
  const incidents = useSourceRows('incidents', sourceOf('incidents'), range);
  const violationsPermitted = useFleetPermission('safety.read');
  const violations = useCachedQuery(
    violationsPermitted ? 'attentionViolations' : null,
    loadViolations,
  );

  // Sources that are still loading hold the list back; those that failed or are not
  // permitted are left out, so one broken source does not hide the rest.
  const loading = [maintenance, incidents].some((data) => data.status === 'loading');

  const items = useMemo(() => {
    if (loading) {
      return [];
    }
    const inScope = new Set(deviceIds);
    return attentionItems({
      expiries: expiryRows,
      maintenance: ready(maintenance),
      incidents: ready(incidents),
      live: liveRows,
      violations: violations.data ?? [],
    }).filter((item) => item.deviceId == null || inScope.has(item.deviceId));
  }, [loading, deviceIds, expiryRows, maintenance, incidents, liveRows, violations.data]);

  if (loading) {
    return <WidgetState state="loading" />;
  }
  if (!items.length) {
    return (
      <EmptyState
        compact
        icon={<TaskAltRoundedIcon />}
        title={t('attentionNone')}
        description={t('attentionNoneHelp')}
      />
    );
  }

  const subject = (item) =>
    (item.kind !== 'violation' && devices[item.deviceId]?.name) ||
    item.name ||
    devices[item.deviceId]?.name ||
    '—';
  const levelLabel = (level) => t(`attentionLevel${capital(level)}`);

  if (table) {
    return (
      <TableView
        columns={[
          { key: 'level', label: t('attentionLevel') },
          { key: 'subject', label: t('sharedName') },
          { key: 'reason', label: t('attentionReason') },
        ]}
        rows={items.map((item) => ({
          key: item.key,
          color: chart.tone(TONE[item.level]),
          cells: { level: levelLabel(item.level), subject: subject(item), reason: describe(item) },
        }))}
      />
    );
  }

  const counts = attentionCounts(items);
  const columns = Math.max(1, Math.min(3, Math.floor(width / MIN_COLUMN)));
  const fit = Math.max(1, Math.floor((height - SUMMARY) / ROW)) * columns;
  const shown = items.slice(0, fit);

  return (
    <div className={classes.root}>
      <div className={classes.summary}>
        {LEVELS.filter((level) => counts[level]).map((level) => (
          <span key={level} className={classes.count}>
            <span className={classes.dot} style={{ backgroundColor: chart.tone(TONE[level]) }} />
            {`${levelLabel(level)}: ${counts[level]}`}
          </span>
        ))}
        {items.length > shown.length && (
          <span className={classes.more}>
            {t('attentionMore').replace('{0}', items.length - shown.length)}
          </span>
        )}
      </div>
      <ul
        className={classes.list}
        style={{
          // Ranked down each column, then the next, like reading a list.
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${Math.ceil(shown.length / columns)}, auto)`,
          gridAutoFlow: 'column',
        }}
      >
        {shown.map((item) => (
          <li key={item.key}>
            <ButtonBase component={RouterLink} to={item.path} className={classes.row} focusRipple>
              <span
                className={classes.dot}
                style={{ backgroundColor: chart.tone(TONE[item.level]) }}
              />
              <span className={classes.main}>
                <span className={classes.primary}>
                  <span style={visuallyHidden}>{`${levelLabel(item.level)}: `}</span>
                  {subject(item)}
                </span>
                <span className={classes.secondary}>{describe(item)}</span>
              </span>
            </ButtonBase>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AttentionWidget;
