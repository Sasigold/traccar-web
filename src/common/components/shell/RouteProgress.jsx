import { useEffect, useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  bar: {
    position: 'fixed',
    insetInline: 0,
    top: 0,
    height: 2,
    zIndex: theme.zIndex.tooltip,
    overflow: 'hidden',
    '&::after': {
      content: '""',
      position: 'absolute',
      insetBlock: 0,
      width: '40%',
      backgroundColor: theme.palette.cta.main,
      animation: 'vf-route-progress 1.1s ease-in-out infinite',
    },
    '@keyframes vf-route-progress': {
      from: { insetInlineStart: '-40%' },
      to: { insetInlineStart: '100%' },
    },
    '@media (prefers-reduced-motion: reduce)': {
      '&::after': { animation: 'none', width: '100%' },
    },
  },
}));

// LIV-16: moving to a screen that is still loading shows a thin aqua bar at the top (after
// 150ms, so fast screens show nothing); the menus and the bar stay in place.
const RouteProgress = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 150);
    return () => clearTimeout(timer);
  }, []);
  return shown ? (
    <div className={classes.bar} role="progressbar" aria-label={t('sharedLoading')} />
  ) : null;
};

export default RouteProgress;
