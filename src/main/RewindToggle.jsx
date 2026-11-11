import { lazy, Suspense, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useTranslation } from '../common/components/LocalizationProvider';

const FleetRewindBar = lazy(() => import('./FleetRewindBar'));

export const useDockStyles = makeStyles()((theme) => ({
  // Full width and centred, so it sits in the middle of the map in either direction.
  dock: {
    position: 'absolute',
    insetInline: 0,
    // Above the map's scale and attribution.
    bottom: theme.spacing(7),
    display: 'flex',
    justifyContent: 'center',
    gap: theme.spacing(1),
    pointerEvents: 'none',
    zIndex: 3,
    [theme.breakpoints.down('md')]: {
      bottom: theme.spacing(10),
    },
  },
}));

export const useToggleStyles = makeStyles()((theme) => ({
  toggle: {
    pointerEvents: 'auto',
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[3],
    '&:hover': { backgroundColor: theme.palette.background.paper },
  },
}));

// LIV-26: the button that opens the fleet rewind; the slider loads only when it is opened.
// `extra`: more buttons in the same dock (the heat layer), hidden while the rewind is open.
const RewindToggle = ({ deviceIds, onRewind, startPadding = 0, extra = null }) => {
  const { classes } = useToggleStyles();
  const { classes: dock } = useDockStyles();
  const t = useTranslation();
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <Suspense fallback={null}>
        <FleetRewindBar
          deviceIds={deviceIds}
          onRewind={onRewind}
          onClose={() => setOpen(false)}
          startPadding={startPadding}
        />
      </Suspense>
    );
  }
  return (
    <div className={dock.dock} style={{ paddingInlineStart: startPadding }}>
      <Tooltip title={t('rewindOpen')}>
        <IconButton
          className={classes.toggle}
          aria-label={t('rewindOpen')}
          onClick={() => setOpen(true)}
        >
          <HistoryRoundedIcon />
        </IconButton>
      </Tooltip>
      {extra}
    </div>
  );
};

export default RewindToggle;
