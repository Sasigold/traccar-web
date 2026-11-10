import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Typography, Button, Chip, Stack } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useSearchParams } from 'react-router-dom';
import { default as Hls, Events } from 'hls.js';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
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
  channels: {
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

// idle → connecting → playing; any failure → error (with a retry).
const StreamPage = () => {
  const { classes, cx } = useStyles();
  const t = useTranslation();

  const videoRef = useRef(null);

  const [channel, setChannel] = useState(1);
  const [activeChannel, setActiveChannel] = useState(null);
  const [state, setState] = useState('idle');
  const [attempt, setAttempt] = useState(0);

  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId');
  const device = useSelector((state) => state.devices.items[deviceId]);

  const running = activeChannel !== null;

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
    if (activeChannel === null) return undefined;
    const video = videoRef.current;
    const mode = playbackMode(Hls, video);
    if (mode === 'unsupported') {
      setState('unsupported');
      return undefined;
    }
    setState('connecting');
    sendCommand('videoStart', { index: activeChannel });
    const url = streamUrl(deviceId, activeChannel);
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
      sendCommand('videoStop', { index: activeChannel });
    };
  }, [deviceId, activeChannel, attempt, sendCommand]);

  const start = () => setActiveChannel(channel);
  const stop = () => {
    setActiveChannel(null);
    setState('idle');
  };
  const retry = () => setAttempt((value) => value + 1);

  return (
    <div className={classes.root}>
      <PageHeader
        back
        title={device?.name || t('linkLiveVideo')}
        description={t('linkLiveVideo')}
        actions={
          running ? (
            <Button variant="outlined" startIcon={<StopRoundedIcon />} onClick={stop}>
              {t('sharedStop')}
            </Button>
          ) : (
            <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={start}>
              {t('sharedPlay')}
            </Button>
          )
        }
      />
      <div className={classes.channels}>
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
      </div>
      <div className={classes.video}>
        {running && (
          <video
            ref={videoRef}
            className={cx(classes.player, state !== 'playing' && classes.hidden)}
            autoPlay
            muted
            playsInline
            controls
            aria-label={t('streamChannelNumber').replace('{0}', activeChannel)}
          />
        )}
        {state === 'idle' && (
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
            <BrandLoader size={64} label={t('streamConnecting')} />
            <Typography>{t('streamConnecting')}</Typography>
          </div>
        )}
        {(state === 'error' || state === 'unsupported') && (
          <div className={classes.overlay} role="alert">
            <VideocamOffRoundedIcon className={classes.icon} />
            <Typography variant="h6">
              {state === 'error' ? t('streamFailed') : t('streamUnsupported')}
            </Typography>
            {state === 'error' && (
              <>
                <Typography variant="body2" className={classes.muted}>
                  {t('streamFailedHint')}
                </Typography>
                <Button variant="contained" onClick={retry}>
                  {t('streamRetry')}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamPage;
