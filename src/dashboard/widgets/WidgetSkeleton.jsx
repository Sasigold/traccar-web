import { Skeleton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5, 1.5),
  },
  bars: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

const BAR_HEIGHTS = ['45%', '70%', '55%', '85%', '40%', '65%', '75%'];

// REP-21: a still shape of what is coming (columns, a ring, a number, rows) with a quiet
// shimmer, instead of a brand loader in every widget. The brand loader is for a page's first
// load only (BRAND §7.9).
const WidgetSkeleton = ({ shape = 'rows', label }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  let content;
  if (shape === 'bars') {
    content = (
      <div className={classes.bars}>
        {BAR_HEIGHTS.map((height, index) => (
          <Skeleton
            key={index}
            variant="rounded"
            width="100%"
            height={height}
            animation="wave"
            sx={{ bgcolor: 'surface.tint' }}
          />
        ))}
      </div>
    );
  } else if (shape === 'ring') {
    content = (
      <div className={classes.center}>
        <Skeleton
          variant="circular"
          width={120}
          height={120}
          animation="wave"
          sx={{ bgcolor: 'surface.tint' }}
        />
      </div>
    );
  } else if (shape === 'number') {
    content = (
      <div className={classes.center}>
        <Skeleton
          variant="rounded"
          width="45%"
          height={44}
          animation="wave"
          sx={{ bgcolor: 'surface.tint' }}
        />
      </div>
    );
  } else {
    content = [0, 1, 2, 3].map((index) => (
      <Skeleton
        key={index}
        variant="rounded"
        height={28}
        animation="wave"
        sx={{ bgcolor: 'surface.tint' }}
      />
    ));
  }
  return (
    <div className={classes.root} role="status" aria-label={label ?? t('sharedLoading')}>
      {content}
    </div>
  );
};

// Which shape a chart widget's view will take.
export const shapeOf = (viz) => {
  if (['donut', 'pie', 'meter'].includes(viz)) return 'ring';
  if (['kpi', 'number', 'stat'].includes(viz)) return 'number';
  if (['table', 'list', 'ranked'].includes(viz)) return 'rows';
  return 'bars';
};

export default WidgetSkeleton;
