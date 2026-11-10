// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { Button, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BrandLoader from '../../common/components/brand/BrandLoader';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  loading: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background.default,
    zIndex: 1,
  },
  failed: {
    position: 'absolute',
    insetInline: 0,
    top: theme.spacing(2),
    marginInline: 'auto',
    width: 'fit-content',
    maxWidth: 'calc(100% - 32px)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderRadius: theme.tokens.radius.lg,
    zIndex: 2,
  },
}));

// LIV-12: the map says it is loading, and when it could not load, offers to retry or switch.
export const MapLoading = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <div className={classes.loading} role="status" aria-label={t('mapLoading')}>
      <BrandLoader size={56} label={t('mapLoading')} />
    </div>
  );
};

export const MapFailed = ({ onRetry, onSwitch, canSwitch }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <Paper className={classes.failed} role="alert">
      <Typography variant="body2">{t('mapLoadFailed')}</Typography>
      <Button size="small" onClick={onRetry}>
        {t('mapRetry')}
      </Button>
      {canSwitch && (
        <Button size="small" onClick={onSwitch}>
          {t('mapSwitchLayer')}
        </Button>
      )}
    </Paper>
  );
};
