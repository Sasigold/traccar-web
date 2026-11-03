import { Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LogoImage from './LogoImage';
import SyncArc from '../common/components/brand/SyncArc';
import { useTranslation } from '../common/components/LocalizationProvider';
import { brandPanel } from '../common/theme/surfaces';

// Login screen composed like the brand book cover (pages 01 and 16): a flat
// midnight navy panel with the reverse logo, a two-line display headline whose
// second line is aqua, and the Sync Point arc bleeding off the edge.
const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 46%) minmax(0, 1fr)',
    height: '100%',
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      overflow: 'auto',
    },
  },
  brand: {
    ...brandPanel(),
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(6, 7),
    [theme.breakpoints.down('lg')]: {
      padding: theme.spacing(5),
    },
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    marginTop: 'clamp(40px, 13vh, 150px)',
  },
  headline: {
    fontWeight: 400,
    lineHeight: 1.1,
    letterSpacing: '-0.01em',
    fontSize: 'clamp(2.25rem, 3.7vw, 3.75rem)',
    color: theme.palette.brand.paper,
  },
  headlineLine: {
    display: 'block',
    whiteSpace: 'nowrap',
  },
  headlineAccent: {
    color: theme.palette.brand.aqua,
  },
  tagline: {
    color: theme.palette.brand.ice,
    opacity: 0.86,
    lineHeight: 1.7,
    fontSize: '1.0625rem',
    maxWidth: 420,
  },
  brandLine: {
    position: 'relative',
    zIndex: 1,
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.palette.brand.paper,
    textAlign: 'start',
  },
  mobileBrand: {
    display: 'none',
    [theme.breakpoints.down('md')]: {
      ...brandPanel(),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: 132,
      padding: theme.spacing(3),
      position: 'relative',
      overflow: 'hidden',
    },
  },
  formSide: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
    overflow: 'auto',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
      alignItems: 'flex-start',
    },
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing(5),
    borderRadius: theme.tokens.radius.xxl,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    boxShadow: theme.shadows[2],
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(3),
      maxWidth: 'none',
      boxShadow: 'none',
    },
  },
}));

const LoginLayout = ({ children }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();

  return (
    <main className={classes.root}>
      <section className={classes.brand}>
        <LogoImage variant="reverse" height={44} />
        <div className={classes.brandContent}>
          <Typography variant="h1" component="p" className={classes.headline}>
            <span className={classes.headlineLine}>{t('loginHeadline')}</span>
            <span className={cx(classes.headlineLine, classes.headlineAccent)}>
              {t('loginHeadlineAccent')}
            </span>
          </Typography>
          <Typography variant="body1" className={classes.tagline}>
            {t('loginTagline')}
          </Typography>
        </div>
        {/* Brand signature: always Latin, left to right, bottom-left (inline dir, not
            CSS direction, which the RTL style plugin would flip). */}
        <span className={classes.brandLine} dir="ltr">
          {t('loginBrandLine')}
        </span>
        <SyncArc
          style={{ right: -24, bottom: '7%', width: 'clamp(150px, 17vw, 270px)', height: 'auto' }}
        />
      </section>
      <div className={classes.mobileBrand}>
        <LogoImage variant="reverse" height={36} />
      </div>
      <div className={classes.formSide}>
        <Paper className={classes.card} elevation={0}>
          <form>{children}</form>
        </Paper>
      </div>
    </main>
  );
};

export default LoginLayout;
