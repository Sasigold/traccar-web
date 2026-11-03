import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Typography, Button, TextField } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useSearchParams } from 'react-router-dom';
import { default as Hls, Events } from 'hls.js';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatchCallback } from '../reactHelper';
import PageHeader from '../common/components/shell/PageHeader';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  video: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(0, 3, 3),
    borderRadius: theme.tokens.radius.xl,
    backgroundColor: theme.palette.brand.ink,
    color: theme.palette.brand.paper,
    overflow: 'hidden',
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
      borderRadius: 0,
    },
  },
  player: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  channel: {
    width: 110,
  },
}));

const StreamPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();

  const videoRef = useRef(null);

  const [channel, setChannel] = useState(1);
  const [activeChannel, setActiveChannel] = useState(null);
  const [error, setError] = useState(false);

  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId');
  const device = useSelector((state) => state.devices.items[deviceId]);

  const playing = activeChannel !== null;

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
    if (activeChannel !== null) {
      sendCommand('videoStart', { index: activeChannel });
      const hls = new Hls();
      const url = `api/stream/${deviceId}/${activeChannel}/live.m3u8`;
      hls.loadSource(new URL(url, document.baseURI).href);
      hls.attachMedia(videoRef.current);
      hls.on(Events.MANIFEST_PARSED, () => videoRef.current.play());
      hls.on(Events.ERROR, (_, data) => {
        if (data.fatal) setError(true);
      });
      return () => {
        hls.destroy();
        sendCommand('videoStop', { index: activeChannel });
      };
    }
  }, [deviceId, activeChannel, sendCommand]);

  return (
    <div className={classes.root}>
      <PageHeader
        back
        title={device?.name || t('linkLiveVideo')}
        description={t('linkLiveVideo')}
        actions={
          <>
            <TextField
              size="small"
              type="number"
              value={channel}
              onChange={(event) => setChannel(Number(event.target.value) || 1)}
              label={t('commandIndex')}
              disabled={playing}
              className={classes.channel}
            />
            <Button
              variant="contained"
              color={playing ? 'error' : 'primary'}
              startIcon={playing ? <StopRoundedIcon /> : <PlayArrowRoundedIcon />}
              onClick={() => {
                setError(false);
                setActiveChannel(playing ? null : channel);
              }}
            >
              {playing ? t('sharedStop') : t('sharedPlay')}
            </Button>
          </>
        }
      />
      <div className={classes.video}>
        {error && <Typography>{t('errorConnection')}</Typography>}
        {playing && !error && (
          <video ref={videoRef} className={classes.player} autoPlay muted controls />
        )}
      </div>
    </div>
  );
};

export default StreamPage;
