import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Button, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PictureInPictureAltRoundedIcon from '@mui/icons-material/PictureInPictureAltRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import VehicleSelect from '../common/components/VehicleSelect';
import FollowTile from './FollowTile';
import { wallVehicles } from './followWall';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 3, 3),
    height: '100%',
    minHeight: 0,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1.5),
    },
  },
  controls: {
    display: 'grid',
    gap: theme.spacing(1.5),
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) minmax(170px, auto)',
    alignItems: 'center',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  grid: {
    flex: 1,
    minHeight: 420,
    display: 'grid',
    gap: theme.spacing(1.5),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(220px, 1fr)',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  pip: {
    height: '100vh',
    display: 'flex',
    margin: 0,
  },
}));

const SLOTS = 4;
const ROTATE_SECONDS = [0, 15, 30, 60];

// LIV-28: up to four vehicles followed at once, each on its own small map. Pick them by hand,
// or let the wall go through the groups (a control-room screen). One tile can stay visible in a
// small window over other work (Picture-in-Picture, where the browser offers it).
const FollowWallPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const devices = useSelector((state) => state.devices.items);
  const groups = useSelector((state) => state.groups.items);
  const chosen = (searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, SLOTS);
  const rotate = Number(searchParams.get('rotate')) || 0;
  const [tick, setTick] = useState(0);
  const [pip, setPip] = useState(null);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!rotate) return undefined;
    const timer = setInterval(() => setTick((value) => value + 1), rotate * 1000);
    return () => clearInterval(timer);
  }, [rotate]);

  const { ids, groupName } = useMemo(
    () => wallVehicles({ chosen, rotate, tick, devices, groups, slots: SLOTS }),
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- chosen is derived from the URL
    [searchParams, tick, devices, groups],
  );

  const openPip = async () => {
    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 360,
      height: 300,
    });
    // The page's styles, so the tile looks the same in the small window.
    [...document.styleSheets].forEach((sheet) => {
      try {
        const style = document.createElement('style');
        style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
        pipWindow.document.head.appendChild(style);
      } catch {
        if (sheet.href) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = sheet.href;
          pipWindow.document.head.appendChild(link);
        }
      }
    });
    pipWindow.document.body.style.margin = '0';
    pipWindow.addEventListener('pagehide', () => setPip(null));
    setPip({ window: pipWindow, deviceId: ids[0] });
  };

  const pipAvailable = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  return (
    <PageLayout breadcrumbs={['followWall']} description={t('followWallDescription')}>
      <div className={classes.root}>
        <div className={classes.controls}>
          {Array.from({ length: SLOTS }, (_, index) => (
            <VehicleSelect
              key={index}
              label={`${t('followSlot')} ${index + 1}`}
              value={chosen[index] || ''}
              disabled={Boolean(rotate)}
              onChange={(deviceId) => {
                const next = [...chosen];
                next[index] = deviceId;
                setParam('ids', next.filter(Boolean).join(','));
              }}
            />
          ))}
          <TextField
            select
            label={t('followRotate')}
            value={rotate}
            onChange={(event) => setParam('rotate', Number(event.target.value) || '')}
          >
            {ROTATE_SECONDS.map((seconds) => (
              <MenuItem key={seconds} value={seconds}>
                {seconds
                  ? t('followRotateEvery').replace('{0}', String(seconds))
                  : t('followRotateOff')}
              </MenuItem>
            ))}
          </TextField>
        </div>
        {rotate > 0 && groupName && (
          <Typography variant="subtitle1" component="p" role="status">
            {t('followGroupNow').replace('{0}', groupName)}
          </Typography>
        )}
        {pipAvailable && ids.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<PictureInPictureAltRoundedIcon />}
            sx={{ alignSelf: 'flex-start' }}
            onClick={openPip}
          >
            {t('followPip')}
          </Button>
        )}
        {ids.length ? (
          <div className={classes.grid}>
            {ids.map((deviceId) => (
              <FollowTile key={deviceId} deviceId={deviceId} />
            ))}
          </div>
        ) : (
          <Typography color="textSecondary">{t('followEmpty')}</Typography>
        )}
      </div>
      {pip &&
        createPortal(
          <div className={classes.pip}>
            <FollowTile deviceId={pip.deviceId} />
          </div>,
          pip.window.document.body,
        )}
    </PageLayout>
  );
};

export default FollowWallPage;
