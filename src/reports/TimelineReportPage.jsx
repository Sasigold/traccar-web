import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { IconButton, Link, Paper, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import dayjs from 'dayjs';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { DateField } from '../common/components/pickers';
import { PreviousPeriodIcon, NextPeriodIcon } from '../common/components/PeriodArrowIcons';
import TableShimmer from '../common/components/TableShimmer';
import ReportsMenu from './components/ReportsMenu';
import ReportIntro from './components/ReportIntro';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { formatHours } from '../dashboard/data/format';
import { privateRows } from '../common/fleet/privacyData';
import { buildTimeline } from './common/timeline';

const MAX_VEHICLES = 60;
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

const useStyles = makeStyles()((theme) => ({
  // A grid, not a flex column: the chart keeps its full height and the page scrolls.
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignContent: 'start',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 3, 3),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  legend: {
    display: 'flex',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
    marginInlineStart: 'auto',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  swatch: {
    width: 14,
    height: 10,
    borderRadius: 2,
  },
  chart: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.divider}`,
    overflowX: 'auto',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 220px) minmax(480px, 1fr)',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1),
    alignItems: 'center',
  },
  label: {
    minWidth: 0,
  },
  name: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  track: {
    position: 'relative',
    height: 28,
  },
  hours: {
    position: 'relative',
    height: 18,
  },
  hourLabel: {
    position: 'absolute',
    whiteSpace: 'nowrap',
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: theme.palette.divider,
  },
  segment: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    minWidth: 2,
    padding: 0,
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.focus}`,
      outlineOffset: 1,
    },
  },
  driving: {
    backgroundColor: theme.palette.dataviz.single,
  },
  idle: {
    backgroundColor: theme.palette.warning.main,
  },
  parked: {
    backgroundColor: theme.palette.dataviz.track,
  },
  nodata: {
    backgroundColor: 'transparent',
    border: `1px dashed ${theme.palette.dataviz.axis}`,
    cursor: 'default',
  },
  note: {
    color: theme.palette.text.secondary,
  },
}));

const TYPES = ['driving', 'idle', 'parked', 'nodata'];
const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());

// /reports/timeline (REP-23): what every vehicle did across one day, as a bar per vehicle.
// Driving opens the replay of that trip.
const TimelineReportPage = () => {
  const { classes, cx, theme } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const allDevices = useSelector((state) => state.devices.items);
  const day = searchParams.get('day') || dayjs().format('YYYY-MM-DD');
  const selectedKey = searchParams.getAll('deviceId').join(',');
  const [rows, setRows] = useState(null);

  const devices = useMemo(() => {
    const selected = selectedKey ? selectedKey.split(',').map(Number) : [];
    const list = Object.values(allDevices).filter(
      (device) => !selected.length || selected.includes(device.id),
    );
    return list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_VEHICLES);
  }, [allDevices, selectedKey]);

  const from = useMemo(() => dayjs(day).startOf('day'), [day]);
  const to = useMemo(() => from.add(1, 'day'), [from]);

  useAsyncTask(
    async ({ signal }) => {
      setRows(null);
      if (!devices.length) {
        setRows([]);
        return;
      }
      const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
      devices.forEach((device) => query.append('deviceId', device.id));
      const load = (type) =>
        fetchOrThrow(`api/reports/${type}?${query}`, {
          headers: { Accept: 'application/json' },
          signal,
        }).then((response) => response.json());
      const [trips, stops] = await Promise.all([load('trips'), load('stops')]);
      // Times stay; places in hidden time are not used here anyway, and the look is logged.
      const ids = devices.map((device) => device.id);
      const [maskedTrips, maskedStops] = await Promise.all([
        privateRows(trips, { deviceIds: ids, from: from.valueOf(), to: to.valueOf() }),
        privateRows(stops, {
          deviceIds: ids,
          from: from.valueOf(),
          to: to.valueOf(),
          view: 'report',
        }),
      ]);
      setRows(
        buildTimeline(devices, maskedTrips.rows, maskedStops.rows, from.valueOf(), to.valueOf()),
      );
    },
    [from, to, devices],
  );

  const setDay = (value) => {
    const next = new URLSearchParams(searchParams);
    next.set('day', value);
    setSearchParams(next, { replace: true });
  };

  // Hour labels sit centered on their tick; the first and last stay inside the chart. Inline
  // styles are not flipped for RTL, so the centering shift follows the page direction.
  const hourStyle = (hour) => {
    if (hour === 0) return { insetInlineStart: 0 };
    if (hour === 24) return { insetInlineEnd: 0 };
    return {
      insetInlineStart: `${(hour / 24) * 100}%`,
      transform: theme.direction === 'rtl' ? 'translateX(50%)' : 'translateX(-50%)',
    };
  };

  const position = (time) =>
    `${((time - from.valueOf()) / (to.valueOf() - from.valueOf())) * 100}%`;
  const width = (segment) =>
    `${((segment.end - segment.start) / (to.valueOf() - from.valueOf())) * 100}%`;

  const describe = (segment) => {
    const range = `${formatTime(segment.start, 'clock')}–${formatTime(segment.end, 'clock')}`;
    const duration = formatHours((segment.end - segment.start) / 3600000);
    return `${t(`timeline${capital(segment.type)}`)} · ${range} · ${duration}`;
  };

  const open = (device, segment) => {
    if (segment.type === 'driving') {
      const query = new URLSearchParams({
        deviceId: device.id,
        from: new Date(segment.row.startTime).toISOString(),
        to: new Date(segment.row.endTime).toISOString(),
      });
      navigate(`/replay?${query}`);
    }
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportTimeline']}>
      <div className={classes.root}>
        <ReportIntro />
        <div className={classes.controls}>
          <IconButton
            aria-label={t('a11yPreviousPeriod')}
            onClick={() => setDay(from.subtract(1, 'day').format('YYYY-MM-DD'))}
          >
            <PreviousPeriodIcon />
          </IconButton>
          <DateField
            label={t('timelineDay')}
            value={day}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
          <IconButton
            aria-label={t('a11yNextPeriod')}
            onClick={() => setDay(from.add(1, 'day').format('YYYY-MM-DD'))}
            disabled={!to.isBefore(dayjs())}
          >
            <NextPeriodIcon />
          </IconButton>
          <div className={classes.legend} aria-hidden>
            {TYPES.map((type) => (
              <span key={type} className={classes.legendItem}>
                <span className={cx(classes.swatch, classes[type])} />
                <Typography variant="caption">{t(`timeline${capital(type)}`)}</Typography>
              </span>
            ))}
          </div>
        </div>

        <Paper elevation={0} className={classes.chart}>
          <div className={classes.grid}>
            <span />
            <div className={classes.hours} aria-hidden>
              {HOURS.map((hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  className={classes.hourLabel}
                  style={hourStyle(hour)}
                >
                  {String(hour).padStart(2, '0')}
                </Typography>
              ))}
            </div>
            {!rows && (
              <div style={{ gridColumn: '1 / -1' }}>
                <TableShimmer columns={2} />
              </div>
            )}
            {rows?.map(({ device, segments, totals }) => (
              <div
                key={device.id}
                style={{ display: 'contents' }}
                role="group"
                aria-label={device.name}
              >
                <div className={classes.label}>
                  <Link
                    component={RouterLink}
                    to={`/fleet/vehicle/${device.id}`}
                    className={classes.name}
                  >
                    {device.name}
                  </Link>
                  <Typography variant="caption" className={classes.note}>
                    {totals.trips
                      ? t('timelineTotals')
                          .replace('{0}', formatHours(totals.driving / 3600000))
                          .replace('{1}', formatHours(totals.idle / 3600000))
                      : t('timelineNoTrips')}
                  </Typography>
                </div>
                <div className={classes.track}>
                  {HOURS.slice(1, -1).map((hour) => (
                    <span
                      key={hour}
                      className={classes.tick}
                      style={{ insetInlineStart: `${(hour / 24) * 100}%` }}
                    />
                  ))}
                  {segments.map((segment) => (
                    <Tooltip key={`${segment.type}-${segment.start}`} title={describe(segment)}>
                      <button
                        type="button"
                        aria-label={describe(segment)}
                        className={cx(classes.segment, classes[segment.type])}
                        style={{ insetInlineStart: position(segment.start), width: width(segment) }}
                        onClick={() => open(device, segment)}
                      />
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {rows && Object.keys(allDevices).length > MAX_VEHICLES && !selectedKey && (
            <Typography variant="body2" className={classes.note} sx={{ mt: 2 }}>
              {t('timelineLimit').replace('{0}', MAX_VEHICLES)}
            </Typography>
          )}
        </Paper>
      </div>
    </PageLayout>
  );
};

export default TimelineReportPage;
