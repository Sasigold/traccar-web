import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link as RouterLink } from 'react-router-dom';
import { Button, IconButton, Link, Paper, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { formatLongDate, formatTime, getFormatLocale } from '../../common/util/formatter';
import { monthGrid, weekdayLabels } from '../../common/components/pickers/pickerUtils';
import { calendarEntries, dailyRates, dayKey } from '../../common/fleet/maintenanceCalendar';
import { MaintenanceChip } from './MaintenanceStatusTable';

// How far back the daily pace of a vehicle is measured, for plans by distance or engine hours.
const PACE_DAYS = 30;

const useStyles = makeStyles()((theme) => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    flexWrap: 'wrap',
  },
  title: {
    flexGrow: 1,
  },
  weekdays: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
  },
  weekday: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: theme.spacing(0.5),
  },
  cell: {
    minHeight: 84,
    padding: theme.spacing(0.75),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  outside: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  outsideNumber: {
    color: theme.palette.text.disabled,
  },
  today: {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
  },
  dayNumber: {
    ...theme.typography.caption,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.secondary,
  },
  entry: {
    display: 'block',
    ...theme.typography.caption,
    lineHeight: 1.3,
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.borderRadius,
    borderInlineStart: '3px solid',
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  ok: { borderInlineStartColor: theme.palette.success.main },
  due: { borderInlineStartColor: theme.palette.warning.main },
  overdue: { borderInlineStartColor: theme.palette.error.main },
  unknown: { borderInlineStartColor: theme.palette.divider },
  section: {
    padding: theme.spacing(1.5, 2),
    marginBottom: theme.spacing(1.5),
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  agendaDay: {
    marginBottom: theme.spacing(1.5),
  },
  muted: {
    color: theme.palette.text.secondary,
  },
}));

const entryLabel = (entry) => `${entry.device?.name || entry.deviceId} · ${entry.maintenance.name}`;

// One line of a list (overdue, agenda on the phone): vehicle, plan, status and date.
const EntryLine = ({ entry, showDate }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <li className={classes.listItem}>
      <Link component={RouterLink} to={`/settings/device/${entry.deviceId}`}>
        {entry.device?.name || entry.deviceId}
      </Link>
      <Typography variant="body2" component="span">
        {entry.maintenance.name}
      </Typography>
      <MaintenanceChip status={entry.state.status} />
      {entry.forecast && (
        <Typography variant="caption" className={classes.muted}>
          {t('fleetMaintenanceForecast')}
        </Typography>
      )}
      {showDate && entry.date != null && (
        <Typography variant="caption" className={classes.muted}>
          {formatTime(entry.date, 'date')}
        </Typography>
      )}
    </li>
  );
};

// ADM-31: the maintenance plans on a month calendar. Plans by distance or engine hours fall on
// the day the vehicle's pace over the last 30 days reaches them.
const MaintenanceCalendar = ({ rows }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('md'));
  const rtl = theme.direction === 'rtl';

  const [month, setMonth] = useState(() => dayjs().startOf('month'));
  const [rates, setRates] = useState(null);
  const [now] = useState(() => Date.now());

  const deviceIds = useMemo(
    () => [...new Set((rows || []).map((row) => row.deviceId))].sort((a, b) => a - b).join(','),
    [rows],
  );

  useAsyncTask(
    async ({ signal }) => {
      if (!deviceIds) {
        setRates({});
        return;
      }
      const to = dayjs();
      const query = new URLSearchParams({
        from: to.subtract(PACE_DAYS, 'day').toISOString(),
        to: to.toISOString(),
      });
      deviceIds.split(',').forEach((id) => query.append('deviceId', id));
      try {
        const response = await fetchOrThrow(`api/reports/summary?${query}`, {
          headers: { Accept: 'application/json' },
          signal,
        });
        setRates(dailyRates(await response.json(), PACE_DAYS));
      } catch (error) {
        if (error.name === 'AbortError') {
          throw error;
        }
        // Without the pace, plans by date still show; the rest is listed as undated.
        setRates({});
      }
    },
    [deviceIds],
  );

  const { byDay, overdue, undated } = useMemo(
    () => calendarEntries(rows, rates || {}, now),
    [rows, rates, now],
  );

  const todayKey = dayKey(now);
  const days = monthGrid(month);
  const PrevIcon = rtl ? ChevronRightRoundedIcon : ChevronLeftRoundedIcon;
  const NextIcon = rtl ? ChevronLeftRoundedIcon : ChevronRightRoundedIcon;
  const monthTitle = new Intl.DateTimeFormat(getFormatLocale(), {
    month: 'long',
    year: 'numeric',
  }).format(month.toDate());

  const agendaDays = days
    .filter((day) => day.month() === month.month())
    .map((day) => ({ day, entries: byDay[dayKey(day.valueOf())] || [] }))
    .filter(({ entries }) => entries.length > 0);

  return (
    <div>
      {overdue.length > 0 && (
        <Paper variant="outlined" className={classes.section}>
          <Typography variant="subtitle2" gutterBottom>
            {t('fleetMaintenanceCalendarOverdue').replace('{0}', String(overdue.length))}
          </Typography>
          <ul className={classes.list}>
            {overdue.map((entry) => (
              <EntryLine key={entry.key} entry={entry} />
            ))}
          </ul>
        </Paper>
      )}

      <div className={classes.header}>
        <Typography variant="h6" component="h2" className={classes.title} aria-live="polite">
          {monthTitle}
        </Typography>
        <Button size="small" onClick={() => setMonth(dayjs().startOf('month'))}>
          {t('fleetMaintenanceCalendarToday')}
        </Button>
        <Tooltip title={t('fleetMaintenanceCalendarPrevious')}>
          <IconButton
            aria-label={t('fleetMaintenanceCalendarPrevious')}
            onClick={() => setMonth((value) => value.subtract(1, 'month'))}
          >
            <PrevIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('fleetMaintenanceCalendarNext')}>
          <IconButton
            aria-label={t('fleetMaintenanceCalendarNext')}
            onClick={() => setMonth((value) => value.add(1, 'month'))}
          >
            <NextIcon />
          </IconButton>
        </Tooltip>
      </div>

      {phone ? (
        <div>
          {agendaDays.length === 0 && (
            <Typography variant="body2" className={classes.muted}>
              {t('fleetMaintenanceCalendarEmpty')}
            </Typography>
          )}
          {agendaDays.map(({ day, entries }) => (
            <div key={day.valueOf()} className={classes.agendaDay}>
              <Typography variant="subtitle2" gutterBottom>
                {formatLongDate(day.toDate())}
              </Typography>
              <ul className={classes.list}>
                {entries.map((entry) => (
                  <EntryLine key={entry.key} entry={entry} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={classes.weekdays} aria-hidden="true">
            {weekdayLabels().map((label) => (
              <span key={label} className={classes.weekday}>
                {label}
              </span>
            ))}
          </div>
          <div className={classes.grid} role="list" aria-label={monthTitle}>
            {days.map((day) => {
              const key = dayKey(day.valueOf());
              const entries = byDay[key] || [];
              return (
                <div
                  key={key}
                  role="listitem"
                  aria-label={formatLongDate(day.toDate())}
                  className={cx(
                    classes.cell,
                    day.month() !== month.month() && classes.outside,
                    key === todayKey && classes.today,
                  )}
                >
                  <span
                    className={cx(
                      classes.dayNumber,
                      day.month() !== month.month() && classes.outsideNumber,
                    )}
                  >
                    {day.date()}
                  </span>
                  {entries.map((entry) => (
                    <Tooltip
                      key={entry.key}
                      title={
                        entry.forecast
                          ? `${entryLabel(entry)} (${t('fleetMaintenanceForecast')})`
                          : entryLabel(entry)
                      }
                    >
                      <Link
                        component={RouterLink}
                        to={`/settings/device/${entry.deviceId}`}
                        underline="none"
                        className={cx(classes.entry, classes[entry.state.status])}
                      >
                        {entry.forecast ? '≈ ' : ''}
                        {entryLabel(entry)}
                      </Link>
                    </Tooltip>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {rates && undated.length > 0 && (
        <Typography variant="body2" className={classes.muted} sx={{ mt: 2 }}>
          {t('fleetMaintenanceCalendarUndated').replace('{0}', String(undated.length))}
        </Typography>
      )}
      <Typography variant="caption" className={classes.muted} component="p" sx={{ mt: 1 }}>
        {t('fleetMaintenanceCalendarHint').replace('{0}', String(PACE_DAYS))}
      </Typography>
    </div>
  );
};

export default MaintenanceCalendar;
