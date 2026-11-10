import { Skeleton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(1.5, 2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  text: {
    flex: 1,
  },
}));

// LIV-11: six rows of shimmer while the vehicles load.
const DeviceListShimmer = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <div className={classes.root} role="status" aria-label={t('sharedLoading')}>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className={classes.row}>
          <Skeleton variant="rounded" width={40} height={40} />
          <div className={classes.text}>
            <Skeleton width="60%" />
            <Skeleton width="40%" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default DeviceListShimmer;
