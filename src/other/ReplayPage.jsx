import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import FastForwardRoundedIcon from '@mui/icons-material/FastForwardRounded';
import FastRewindRoundedIcon from '@mui/icons-material/FastRewindRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapReplayMarker from '../map/MapReplayMarker';
import { formatNumericHours, formatTime } from '../common/util/formatter';

import ReportFilter from '../reports/components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatchCallback } from '../reactHelper';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import StatusCard from '../common/components/StatusCard';
import MapScale from '../map/MapScale';
import MapPadding from '../map/MapPadding';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';
import MapOverlay from '../map/overlay/MapOverlay';
import { ctaFill, glass } from '../common/theme/surfaces';
import { logPrivacyView, privatePositions } from '../common/fleet/privacyData';
import PrivacyNote from '../common/components/PrivacyNote';
import MapMarkers from '../map/MapMarkers';
import ReplayTimeline from './replay/ReplayTimeline';
import {
  SPEEDS,
  quickRange,
  replayStops,
  stepByTime,
  timelineSegments,
} from './replay/replayTimeline';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    position: 'absolute',
    zIndex: theme.layers.panel,
    insetInlineStart: theme.dimensions.panelGap,
    top: theme.dimensions.panelGap,
    width: theme.dimensions.devicePanelWidth,
    maxHeight: `calc(100% - ${theme.dimensions.panelGap * 2}px)`,
    ...glass(theme, 0.92),
    borderRadius: theme.tokens.radius.xxl,
    overflow: 'hidden',
    // LIV-10: on a phone the panel is a sheet at the bottom, so the route stays in view above it.
    [theme.breakpoints.down('md')]: {
      insetInline: 0,
      top: 'auto',
      bottom: 0,
      width: '100%',
      maxHeight: '60%',
      borderRadius: `${theme.tokens.radius.xl}px ${theme.tokens.radius.xl}px 0 0`,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1.5, 1.5, 2),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
  },
  title: {
    flexGrow: 1,
    fontWeight: 600,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    overflowY: 'auto',
    '& .MuiOutlinedInput-root': {
      backgroundColor: theme.palette.background.paper,
    },
  },
  filterGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    '& > div': {
      flexBasis: 'auto !important',
    },
  },
  deviceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  deviceName: {
    fontWeight: 700,
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  play: {
    width: 48,
    height: 48,
    ...ctaFill(theme),
    '&.Mui-disabled': {
      backgroundColor: theme.palette.action.disabledBackground,
    },
  },
  time: {
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    minWidth: 64,
  },
  speeds: {
    alignSelf: 'center',
    '& .MuiToggleButton-root': {
      paddingBlock: 2,
      paddingInline: theme.spacing(1.25),
      fontVariantNumeric: 'tabular-nums',
    },
  },
  stops: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  quick: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  },
  empty: {
    color: theme.palette.text.secondary,
  },
}));

// "23 דק׳", or hours and minutes from an hour up.
const stopLength = (duration, t) =>
  duration < 3600000
    ? `${Math.round(duration / 60000)} ${t('sharedMinuteAbbreviation')}`
    : formatNumericHours(duration, t);

const QUICK = [
  ['today', 'reportToday'],
  ['yesterday', 'reportYesterday'],
  ['last24', 'replayLast24'],
];

const ReplayPage = () => {
  const t = useTranslation();
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [searchParams, setSearchParams] = useSearchParams();

  const defaultDeviceId = useSelector((state) => state.devices.selectedId);

  const [positions, setPositions] = useState([]);
  const [rawIndex, setRawIndex] = useState(0);
  // Never past the end of the route shown (a route can be replaced while it plays).
  const index = Math.max(0, Math.min(rawIndex, positions.length - 1));
  const [selectedDeviceId, setSelectedDeviceId] = useState(defaultDeviceId);
  const [showCard, setShowCard] = useState(false);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [privacy, setPrivacy] = useState(null);
  const [speed, setSpeed] = useState(20);
  const [empty, setEmpty] = useState(false);

  const loaded = Boolean(from && to && !loading && positions.length);

  const deviceName = useSelector((state) => {
    if (selectedDeviceId) {
      const device = state.devices.items[selectedDeviceId];
      if (device) {
        return device.name;
      }
    }
    return null;
  });

  useEffect(() => {
    if (!from && !to) {
      setPositions([]);
    }
  }, [from, to, setPositions]);

  useEffect(() => {
    if (index >= positions.length - 1) {
      setPlaying(false);
    }
  }, [index, positions]);

  const segments = useMemo(() => timelineSegments(positions), [positions]);
  const stops = useMemo(() => replayStops(segments), [segments]);

  // LIV-10: a vehicle without a period (from the card) shows today at once.
  const urlDeviceId = searchParams.get('deviceId');
  const showRange = useCallback(
    (key) => {
      const range = quickRange(key);
      const params = new URLSearchParams(searchParams);
      params.set('period', range.period);
      params.set('from', range.from.toISOString());
      params.set('to', range.to.toISOString());
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  useEffect(() => {
    if (urlDeviceId && !from && !to) {
      showRange('today');
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [urlDeviceId]);

  // Space plays and pauses, arrows move a point and Shift+arrows a minute, wherever the focus is
  // outside a field or a button.
  useEffect(() => {
    if (!positions.length) {
      return undefined;
    }
    const onKeyDown = (event) => {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target.closest?.(
          'input, textarea, select, button, a, [role="slider"], [role="dialog"], [contenteditable="true"]',
        )
      ) {
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setRawIndex((value) =>
          event.shiftKey
            ? stepByTime(positions, value, direction * 60000)
            : Math.min(Math.max(value + direction, 0), positions.length - 1),
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [positions]);

  const onPointClick = useCallback(
    (_, index) => {
      setRawIndex(index);
    },
    [setRawIndex],
  );

  const onMarkerClick = useCallback(
    (positionId) => {
      setShowCard(!!positionId);
    },
    [setShowCard],
  );

  const onShow = useCatchCallback(async ({ deviceIds, from, to }) => {
    const deviceId = deviceIds.find(() => true);
    setLoading(true);
    setSelectedDeviceId(deviceId);
    const query = new URLSearchParams({ deviceId, from, to });
    // A new route stops the playback, so the old position never points past its end.
    setPlaying(false);
    try {
      const response = await fetchOrThrow(`api/positions?${query.toString()}`);
      setRawIndex(0);
      // Locations in hidden time (outside working hours, private periods) are left out.
      const result = await privatePositions(await response.json(), {
        deviceIds: [deviceId],
        from,
        to,
        view: 'replay',
      });
      setPositions(result.positions);
      setPrivacy(result.hidden ? result : null);
      // An empty period is not an error: it is said quietly under the filter.
      setEmpty(!result.positions.length);
      if (result.positions.length) {
        setFilterOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDownload = () => {
    logPrivacyView([selectedDeviceId], 'export', from, to);
    const query = new URLSearchParams({ deviceId: selectedDeviceId, from, to });
    window.location.assign(`api/positions/kml?${query.toString()}`);
  };

  return (
    <div className={classes.root}>
      <MapView>
        <MapOverlay />
        <MapGeofence />
        <MapRoutePath positions={positions} />
        <MapRoutePoints positions={positions} onClick={onPointClick} showSpeedControl />
        {positions.length > 1 && (
          <MapMarkers
            markers={[
              {
                latitude: positions[0].latitude,
                longitude: positions[0].longitude,
                image: 'start-success',
              },
              {
                latitude: positions[positions.length - 1].latitude,
                longitude: positions[positions.length - 1].longitude,
                image: 'finish-error',
              },
            ]}
          />
        )}
        {index < positions.length && (
          <MapReplayMarker
            positions={positions}
            index={index}
            playing={playing}
            speed={speed}
            onIndexChange={setRawIndex}
            onMarkerClick={onMarkerClick}
          />
        )}
      </MapView>
      <MapScale />
      <MapCamera positions={positions} />
      {desktop && (
        <MapPadding start={theme.dimensions.devicePanelWidth + 2 * theme.dimensions.panelGap} />
      )}
      <div className={classes.sidebar}>
        <div className={classes.header}>
          <IconButton aria-label={t('a11yBack')} edge="start" onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            {t('reportReplay')}
          </Typography>
          {loaded && (
            <>
              {/* The KML file comes straight from Traccar, so it is not offered when locations
                  were hidden. */}
              <Tooltip title={t(privacy ? 'privacyExportBlocked' : 'reportExport')}>
                <span>
                  <IconButton
                    aria-label={t('reportExport')}
                    onClick={handleDownload}
                    disabled={Boolean(privacy)}
                  >
                    <DownloadRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('sharedFilter')}>
                <IconButton
                  edge="end"
                  color={filterOpen ? 'primary' : 'default'}
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <TuneRoundedIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </div>
        <div className={classes.content}>
          {loaded && !filterOpen && (
            <>
              <div className={classes.deviceRow}>
                <Typography variant="subtitle1" className={classes.deviceName} noWrap>
                  {deviceName}
                </Typography>
                <Chip
                  size="small"
                  label={`${index + 1} / ${positions.length}`}
                  variant="outlined"
                />
              </div>
              <PrivacyNote hidden={privacy?.hidden} distance={privacy?.hiddenDistance} />
              <ReplayTimeline
                positions={positions}
                segments={segments}
                stops={stops}
                index={index}
                onChange={setRawIndex}
              />
              {/* The player runs left to right, like the gauges. */}
              <div className={classes.controls} dir="ltr">
                <Typography variant="caption" className={classes.time}>
                  {formatTime(positions[0].fixTime, 'time')}
                </Typography>
                <div className={classes.transport}>
                  <IconButton
                    aria-label={t('replayBackMinute')}
                    onClick={() => setRawIndex((value) => stepByTime(positions, value, -60000))}
                    disabled={index <= 0}
                  >
                    <FastRewindRoundedIcon />
                  </IconButton>
                  <IconButton
                    aria-label={t(playing ? 'a11yPause' : 'a11yPlay')}
                    className={classes.play}
                    onClick={() => setPlaying(!playing)}
                    disabled={index >= positions.length - 1}
                  >
                    {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
                  </IconButton>
                  <IconButton
                    aria-label={t('replayForwardMinute')}
                    onClick={() => setRawIndex((value) => stepByTime(positions, value, 60000))}
                    disabled={index >= positions.length - 1}
                  >
                    <FastForwardRoundedIcon />
                  </IconButton>
                </div>
                <Typography variant="caption" className={classes.time} align="right">
                  {dayjs(positions[index].fixTime).format('HH:mm:ss')}
                </Typography>
              </div>
              <ToggleButtonGroup
                className={classes.speeds}
                size="small"
                exclusive
                value={speed}
                onChange={(_, value) => value && setSpeed(value)}
                aria-label={t('replaySpeed')}
              >
                {SPEEDS.map((value) => (
                  <ToggleButton key={value} value={value}>
                    {`${value}×`}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {stops.length > 0 && (
                <>
                  <Typography variant="overline" component="h3">
                    {t('reportStops')}
                  </Typography>
                  <ul className={classes.stops}>
                    {stops.map((stop) => (
                      <li key={stop.index}>
                        <Chip
                          size="small"
                          variant={
                            index >= stop.index &&
                            positions[index] &&
                            new Date(positions[index].fixTime).getTime() < stop.end
                              ? 'filled'
                              : 'outlined'
                          }
                          label={`${dayjs(stop.start).format('HH:mm')} · ${stopLength(stop.duration, t)}`}
                          onClick={() => {
                            setPlaying(false);
                            setRawIndex(stop.index);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {(!loaded || filterOpen) && (
            <div className={classes.quick}>
              {QUICK.map(([key, label]) => (
                <Chip
                  key={key}
                  label={t(label)}
                  disabled={!urlDeviceId || loading}
                  onClick={() => showRange(key)}
                />
              ))}
            </div>
          )}
          {empty && !loading && (!loaded || filterOpen) && (
            <Typography variant="body2" className={classes.empty} role="status">
              {t(privacy ? 'privacyAllHidden' : 'replayEmpty')}
            </Typography>
          )}
          <div
            className={classes.filterGrid}
            style={{ display: loaded && !filterOpen ? 'none' : 'flex' }}
          >
            <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
          </div>
        </div>
      </div>
      {showCard && index < positions.length && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={positions[index]}
          onClose={() => setShowCard(false)}
          disableActions
        />
      )}
    </div>
  );
};

export default ReplayPage;
