import { Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { gridPattern } from '../../common/theme/surfaces';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(7, 3, 6),
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      ...gridPattern(alpha(theme.palette.primary.main, 0.05), 28),
      maskImage: 'radial-gradient(ellipse at 50% 35%, black 10%, transparent 60%)',
      pointerEvents: 'none',
    },
  },
  icon: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    boxShadow: `0 16px 32px -12px ${alpha(theme.palette.primary.main, 0.55)}`,
    marginBottom: theme.spacing(1),
    '& svg': { fontSize: 34 },
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: -8,
      borderRadius: 28,
      border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
    },
  },
  title: {
    position: 'relative',
    fontWeight: 700,
    fontSize: '1.0625rem',
  },
  hint: {
    position: 'relative',
    color: theme.palette.text.secondary,
    maxWidth: 420,
  },
  steps: {
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  step: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: 34,
    paddingInline: theme.spacing(1.5, 1.75),
    borderRadius: theme.tokens.radius.pill,
    fontSize: '0.8125rem',
    fontWeight: 600,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    boxShadow: theme.shadows[1],
  },
  stepIndex: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.6875rem',
    fontWeight: 800,
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
  },
}));

// Shown in report tables before a report has been generated.
const ReportEmptyState = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <div className={classes.root}>
      <span className={classes.icon}>
        <InsightsRoundedIcon />
      </span>
      <Typography className={classes.title}>{t('reportEmptyTitle')}</Typography>
      <Typography variant="body2" className={classes.hint}>
        {t('reportEmptyHint')}
      </Typography>
      <div className={classes.steps}>
        {['reportEmptyStepDevices', 'reportEmptyStepPeriod', 'reportEmptyStepShow'].map(
          (key, index) => (
            <span key={key} className={classes.step}>
              <span className={classes.stepIndex}>{index + 1}</span>
              {t(key)}
            </span>
          ),
        )}
      </div>
    </div>
  );
};

export default ReportEmptyState;
