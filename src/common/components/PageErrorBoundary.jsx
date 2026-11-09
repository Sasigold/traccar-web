import { useLocation } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ErrorBoundary from '../../ErrorBoundary';
import { useTranslation } from './LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
  card: {
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(4, 3),
    borderRadius: theme.tokens.radius.xl,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    textAlign: 'center',
  },
  icon: {
    fontSize: 40,
    color: theme.palette.text.secondary,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  details: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    maxWidth: '100%',
    '& pre': {
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      textAlign: 'start',
      direction: 'ltr',
    },
  },
}));

const PageError = ({ error, reset }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <div className={classes.root}>
      <div className={classes.card} role="alert">
        <ErrorOutlineRoundedIcon className={classes.icon} aria-hidden />
        <Typography variant="h6" component="h1">
          {t('errorPageTitle')}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {t('errorPageText')}
        </Typography>
        <div className={classes.actions}>
          <Button variant="contained" onClick={reset}>
            {t('errorRetry')}
          </Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            {t('errorReload')}
          </Button>
        </div>
        <details className={classes.details}>
          <summary>{t('sharedShowDetails')}</summary>
          <pre>{error?.message}</pre>
        </details>
      </div>
    </div>
  );
};

// Around every page: an error in one page leaves the navigation, the live connection and the
// other pages working. Moving to another address clears it.
const PageErrorBoundary = ({ children }) => {
  const location = useLocation();
  return (
    <ErrorBoundary
      resetKey={location.pathname}
      fallback={(error, reset) => <PageError error={error} reset={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
};

export default PageErrorBoundary;
