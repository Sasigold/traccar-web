import { useEffect, useState } from 'react';
import { MenuItem, TextField } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import dayjs from 'dayjs';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useDashboardData, useLastSynced } from '../data/DashboardDataContext';
import { periodLabel } from './periodLabel';
import { dashboardName } from './DashboardTabs';

export const TV_ROTATIONS = [30, 60, 120, 300];

const grow = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 64,
    paddingBottom: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    position: 'relative',
  },
  name: {
    fontSize: '3rem',
    fontWeight: 600,
    lineHeight: 1.1,
    color: theme.palette.text.primary,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fact: {
    fontSize: '1.375rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  clock: {
    fontSize: '2.25rem',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.text.primary,
  },
  // The next board comes when the thin aqua line reaches the end.
  progress: {
    position: 'absolute',
    insetInline: 0,
    bottom: -1,
    height: 3,
    backgroundColor: theme.palette.brand.aqua,
    transformOrigin: theme.direction === 'rtl' ? 'right' : 'left',
    animationName: grow,
    animationTimingFunction: 'linear',
    animationFillMode: 'both',
    '@media (prefers-reduced-motion: reduce)': { display: 'none' },
  },
}));

// REP-20: the head of a dashboard on a control-room screen: its name, the period, a clock and
// when it was last updated, readable from across the room, and the rotation to the next board.
const TvHeader = ({ dashboard, rotation, onRotation, rotating }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const { filters, range } = useDashboardData();
  const synced = useLastSynced();
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <header className={classes.root}>
      <span className={classes.name}>{dashboardName(dashboard, t)}</span>
      <span className={classes.fact}>{periodLabel(filters, range, t)}</span>
      {synced > 0 && (
        <span className={classes.fact}>
          {t('dashboardTvUpdated').replace('{0}', dayjs(synced).format('HH:mm'))}
        </span>
      )}
      {rotating && (
        <TextField
          select
          size="small"
          label={t('dashboardTvRotation')}
          value={rotation}
          onChange={(event) => onRotation(Number(event.target.value))}
        >
          {TV_ROTATIONS.map((seconds) => (
            <MenuItem key={seconds} value={seconds}>
              {t('dashboardTvSeconds').replace('{0}', seconds)}
            </MenuItem>
          ))}
        </TextField>
      )}
      <span className={classes.clock} dir="ltr">
        {now.format('HH:mm')}
      </span>
      {rotating && (
        <span
          key={`${dashboard.id}-${rotation}`}
          className={classes.progress}
          style={{ animationDuration: `${rotation}s` }}
          aria-hidden
        />
      )}
    </header>
  );
};

export default TvHeader;
