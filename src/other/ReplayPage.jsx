import { useState, useEffect, useRef, useCallback } from 'react';
import { Chip, IconButton, Slider, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import FastForwardRoundedIcon from '@mui/icons-material/FastForwardRounded';
import FastRewindRoundedIcon from '@mui/icons-material/FastRewindRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MapView from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositionMarkers from '../map/MapPositionMarkers';
import { formatTime } from '../common/util/formatter';
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
    [theme.breakpoints.down('md')]: {
      insetInline: 0,
      top: 0,
      width: '100%',
      maxHeight: '70%',
      borderRadius: '0 0 20px 20px',
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
  slider: {
    marginInline: theme.spacing(1),
    width: 'auto',
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
  },
}));

const ReplayPage = () => {
  const t = useTranslation();
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const timerRef = useRef();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [searchParams] = useSearchParams();

  const defaultDeviceId = useSelector((state) => state.devices.selectedId);

  const [positions, setPositions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState(defaultDeviceId);
  const [showCard, setShowCard] = useState(false);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

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
    if (playing && positions.length > 0) {
      timerRef.current = setInterval(() => {
        setIndex((index) => index + 1);
      }, 500);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [playing, positions]);

  useEffect(() => {
    if (index >= positions.length - 1) {
      clearInterval(timerRef.current);
      setPlaying(false);
    }
  }, [index, positions]);

  const onPointClick = useCallback(
    (_, index) => {
      setIndex(index);
    },
    [setIndex],
  );

  const onMarkerClick = useCallback(
    (positionId) => {
      setShowCard(!!positionId);
    },
    [setShowCard],
  );

  const onShow = useCatchCallback(
    async ({ deviceIds, from, to }) => {
      const deviceId = deviceIds.find(() => true);
      setLoading(true);
      setSelectedDeviceId(deviceId);
      const query = new URLSearchParams({ deviceId, from, to });
      try {
        const response = await fetchOrThrow(`api/positions?${query.toString()}`);
        setIndex(0);
        const positions = await response.json();
        setPositions(positions);
        if (!positions.length) {
          throw Error(t('sharedNoData'));
        }
        setFilterOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  const handleDownload = () => {
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
        {index < positions.length && (
          <MapPositionMarkers
            positions={[positions[index]]}
            onMarkerClick={onMarkerClick}
            titleField="fixTime"
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
              <Tooltip title={t('reportExport')}>
                <IconButton onClick={handleDownload}>
                  <DownloadRoundedIcon />
                </IconButton>
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
              <Slider
                className={classes.slider}
                max={positions.length - 1}
                step={null}
                marks={positions.map((_, index) => ({ value: index }))}
                value={index}
                onChange={(_, index) => setIndex(index)}
              />
              <div className={classes.controls}>
                <Typography variant="caption" className={classes.time}>
                  {formatTime(positions[0].fixTime, 'time')}
                </Typography>
                <div className={classes.transport}>
                  <IconButton
                    aria-label={t('a11yPrevious')}
                    onClick={() => setIndex((index) => index - 1)}
                    disabled={playing || index <= 0}
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
                    aria-label={t('a11yNext')}
                    onClick={() => setIndex((index) => index + 1)}
                    disabled={playing || index >= positions.length - 1}
                  >
                    <FastForwardRoundedIcon />
                  </IconButton>
                </div>
                <Typography variant="caption" className={classes.time}>
                  {formatTime(positions[index].fixTime, 'seconds')}
                </Typography>
              </div>
            </>
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
