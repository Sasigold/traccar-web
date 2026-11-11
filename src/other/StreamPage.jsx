import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Typography, Button, Chip, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { default as Hls, Events } from 'hls.js';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { useFleetPermission } from '../common/fleet/useFleet';
import { putPendingFiles } from '../common/util/pendingFiles';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatchCallback } from '../reactHelper';
import PageHeader from '../common/components/shell/PageHeader';
import BrandLoader from '../common/components/brand/BrandLoader';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { STREAM_CHANNELS, STREAM_TIMEOUT, playbackMode, streamUrl } from './streamPlayback';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  video: {
    position: 'relative',
    flexGrow: 1,
    minHeight: 240,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(0, 3, 3),
    borderRadius: theme.tokens.radius.xl,
    backgroundColor: theme.palette.brand.ink,
    color: theme.palette.brand.paper,
    overflow: 'hidden',
    // In dark mode the canvas is close to ink, so the frame needs an edge.
    border: theme.palette.mode === 'dark' ? `1px solid ${theme.palette.surface.border}` : 'none',
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
      borderRadius: 0,
    },
  },
  player: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  hidden: {
    visibility: 'hidden',
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    textAlign: 'center',
  },
  icon: {
    fontSize: 48,
    color: theme.palette.brand.aqua,
  },
  muted: {
    color: theme.palette.brand.ice,
  },
  // LIV-17: four channels at once, two by two.
  grid: {
    flexGrow: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(160px, 1fr)',
    gap: theme.spacing(1),
    margin: theme.spacing(0, 3, 3),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
    },
    '& > *': {
      margin: 0,
      minHeight: 160,
      borderRadius: theme.tokens.radius.lg,
    },
  },
  label: {
    position: 'absolute',
    insetBlockStart: theme.spacing(1),
    insetInlineStart: theme.spacing(1),
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.brand.ink,
    color: theme.palette.brand.paper,
    fontSize: '0.75rem',
    zIndex: 1,
  },
  snapshot: {
    position: 'absolute',
    insetBlockEnd: theme.spacing(1),
    insetInlineEnd: theme.spacing(1),
    zIndex: 1,
  },
  channels: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0, 3, 2),
    overflowX: 'auto',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 1.5),
    },
  },
  // Chips sit on the light page header; the selected one is the aqua pill with ink text.
  chip: {
    fontWeight: 600,
  },
}));

// One camera channel: idle → connecting → playing; any failure → error (with a retry). A
// playing channel offers a snapshot that opens a new incident report with the frame (LIV-17).
const ChannelPlayer = ({ deviceId, index, running, compact, onSnapshot }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const videoRef = useRef(null);
  const [state, setState] = useState('idle');
  const [attempt, setAttempt] = useState(0);

  const sendCommand = useCatchCallback(
    async (type, attributes) => {
      await fetchOrThrow('api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, type, attributes }),
      });
    },
    [deviceId],
  );

  useEffect(() => {
    if (!running) {
      setState('idle');
      return undefined;
    }
    const video = videoRef.current;
    const mode = playbackMode(Hls, video);
    if (mode === 'unsupported') {
      setState('unsupported');
      return undefined;
    }
    setState('connecting');
    sendCommand('videoStart', { index });
    const url = streamUrl(deviceId, index);
    const fail = () => setState((current) => (current === 'playing' ? current : 'error'));
    const timer = setTimeout(fail, STREAM_TIMEOUT);
    const onPlaying = () => {
      clearTimeout(timer);
      setState('playing');
    };
    const onError = () => {
      clearTimeout(timer);
      setState('error');
    };
    video.addEventListener('playing', onPlaying);

    let hls = null;
    if (mode === 'hls') {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Events.ERROR, (_, data) => {
        if (data.fatal) onError();
      });
    } else {
      // Safari on iPhone: no Media Source Extensions, but the player understands HLS itself.
      video.addEventListener('error', onError);
      video.src = url;
      video.play().catch(() => {});
    }
    return () => {
      clearTimeout(timer);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      if (hls) {
        hls.destroy();
      } else {
        video.removeAttribute('src');
        video.load();
      }
      sendCommand('videoStop', { index });
    };
  }, [deviceId, index, running, attempt, sendCommand]);

  const snapshot = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onSnapshot(new File([blob], `camera-${index}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      0.9,
    );
  };

  const name = t('streamChannelNumber').replace('{0}', index);
  return (
    <div
      className={classes.video}
      role={compact ? 'group' : undefined}
      aria-label={compact ? name : undefined}
    >
      {compact && <span className={classes.label}>{name}</span>}
      <video
        ref={videoRef}
        className={cx(classes.player, state !== 'playing' && classes.hidden)}
        autoPlay
        muted
        playsInline
        controls={!compact}
        aria-label={name}
      />
      {state === 'playing' && onSnapshot && (
        <Button
          size="small"
          variant="contained"
          className={classes.snapshot}
          startIcon={<PhotoCameraRoundedIcon />}
          onClick={snapshot}
        >
          {t('streamSnapshot')}
        </Button>
      )}
      {state === 'idle' && !compact && (
        <div className={classes.overlay}>
          <VideocamRoundedIcon className={classes.icon} />
          <Typography variant="h6">{t('streamIdle')}</Typography>
          <Typography variant="body2" className={classes.muted}>
            {t('streamIdleHint')}
          </Typography>
        </div>
      )}
      {state === 'connecting' && (
        <div className={classes.overlay} role="status">
          <BrandLoader size={compact ? 40 : 64} label={t('streamConnecting')} />
          <Typography variant={compact ? 'body2' : 'body1'}>{t('streamConnecting')}</Typography>
        </div>
      )}
      {(state === 'error' || state === 'unsupported') && (
        <div className={classes.overlay} role="alert">
          <VideocamOffRoundedIcon className={classes.icon} />
          <Typography variant={compact ? 'subtitle2' : 'h6'}>
            {state === 'error' ? t('streamFailed') : t('streamUnsupported')}
          </Typography>
          {state === 'error' && (
            <>
              {!compact && (
                <Typography variant="body2" className={classes.muted}>
                  {t('streamFailedHint')}
                </Typography>
              )}
              <Button
                variant="contained"
                size={compact ? 'small' : 'medium'}
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t('streamRetry')}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const StreamPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const canReport = useFleetPermission('incidents.write');

  const [channel, setChannel] = useState(1);
  const [layout, setLayout] = useState('single');
  const [running, setRunning] = useState(false);

  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId');
  const device = useSelector((state) => state.devices.items[deviceId]);

  // LIV-17: the frame goes with a new damage or accident report of this vehicle.
  const onSnapshot = canReport
    ? (file) => {
        putPendingFiles('incident', [file]);
        navigate(`/fleet/incident?deviceId=${deviceId}`);
      }
    : undefined;

  return (
    <div className={classes.root}>
      <PageHeader
        back
        title={device?.name || t('linkLiveVideo')}
        description={t('linkLiveVideo')}
        actions={
          running ? (
            <Button
              variant="outlined"
              startIcon={<StopRoundedIcon />}
              onClick={() => setRunning(false)}
            >
              {t('sharedStop')}
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => setRunning(true)}
            >
              {t('sharedPlay')}
            </Button>
          )
        }
      />
      <div className={classes.channels}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={layout}
          disabled={running}
          onChange={(_, value) => value && setLayout(value)}
          aria-label={t('streamLayout')}
        >
          <ToggleButton value="single">{t('streamLayoutSingle')}</ToggleButton>
          <ToggleButton value="grid">{t('streamLayoutGrid')}</ToggleButton>
        </ToggleButtonGroup>
        {layout === 'single' && (
          <Stack direction="row" spacing={1} role="radiogroup" aria-label={t('streamChannel')}>
            {STREAM_CHANNELS.map((value) => (
              <Chip
                key={value}
                role="radio"
                aria-checked={channel === value}
                label={t('streamChannelNumber').replace('{0}', value)}
                color={channel === value ? 'secondary' : 'default'}
                variant={channel === value ? 'filled' : 'outlined'}
                disabled={running}
                onClick={() => setChannel(value)}
                className={classes.chip}
              />
            ))}
          </Stack>
        )}
      </div>
      {layout === 'single' ? (
        <ChannelPlayer
          deviceId={deviceId}
          index={channel}
          running={running}
          onSnapshot={onSnapshot}
        />
      ) : (
        <div className={classes.grid}>
          {STREAM_CHANNELS.map((value) => (
            <ChannelPlayer
              key={value}
              deviceId={deviceId}
              index={value}
              running={running}
              compact
              onSnapshot={onSnapshot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StreamPage;
