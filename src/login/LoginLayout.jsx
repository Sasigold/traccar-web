import { Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import LogoImage from './LogoImage';
import { useTranslation } from '../common/components/LocalizationProvider';
import { glass, meshBackground } from '../common/theme/surfaces';
import { cyan, indigo, violet } from '../common/theme/tokens';

const drift = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(-6%, 8%, 0) scale(1.08); }
  100% { transform: translate3d(5%, -6%, 0) scale(0.96); }
`;

const noise =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

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
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: theme.spacing(8),
    color: '#ffffff',
    ...meshBackground(),
    [theme.breakpoints.down('lg')]: {
      padding: theme.spacing(5),
    },
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(70px)',
    pointerEvents: 'none',
    opacity: 0.7,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
  blobOne: {
    width: 520,
    height: 520,
    top: -180,
    insetInlineEnd: -160,
    background: indigo[500],
    animation: `${drift} 22s ease-in-out infinite alternate`,
  },
  blobTwo: {
    width: 440,
    height: 440,
    bottom: -180,
    insetInlineStart: -140,
    background: cyan[500],
    opacity: 0.55,
    animation: `${drift} 26s ease-in-out infinite alternate-reverse`,
  },
  blobThree: {
    width: 360,
    height: 360,
    top: '38%',
    insetInlineStart: '36%',
    background: violet[500],
    opacity: 0.45,
    animation: `${drift} 30s ease-in-out infinite alternate`,
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(${alpha('#ffffff', 0.18)} 1px, transparent 1px)`,
    backgroundSize: '28px 28px',
    maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)',
    pointerEvents: 'none',
  },
  noise: {
    position: 'absolute',
    inset: 0,
    backgroundImage: noise,
    opacity: 0.08,
    mixBlendMode: 'overlay',
    pointerEvents: 'none',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    maxWidth: 520,
  },
  headline: {
    fontWeight: 800,
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
    fontSize: 'clamp(2rem, 3vw, 2.75rem)',
  },
  tagline: {
    opacity: 0.86,
    lineHeight: 1.7,
    fontSize: '1.0625rem',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
    marginTop: theme.spacing(1),
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 1.75),
    borderRadius: theme.tokens.radius.lg,
    background: alpha('#ffffff', 0.08),
    border: `1px solid ${alpha('#ffffff', 0.14)}`,
    backdropFilter: 'blur(8px)',
  },
  featureIcon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: alpha('#ffffff', 0.14),
    '& svg': {
      fontSize: 20,
    },
  },
  mobileBrand: {
    display: 'none',
    [theme.breakpoints.down('md')]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 150,
      padding: theme.spacing(3),
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
      ...meshBackground(),
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
  formGlow: {
    position: 'absolute',
    width: 640,
    height: 640,
    top: -260,
    insetInlineEnd: -220,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 65%)`,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing(5),
    borderRadius: theme.tokens.radius.xxl,
    ...glass(theme, 0.86),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(3),
      maxWidth: 'none',
    },
  },
}));

const LoginLayout = ({ children }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();

  const features = [
    { key: 'live', icon: <GpsFixedRoundedIcon />, text: t('loginFeatureLive') },
    { key: 'history', icon: <HistoryRoundedIcon />, text: t('loginFeatureHistory') },
    { key: 'alerts', icon: <NotificationsActiveRoundedIcon />, text: t('loginFeatureAlerts') },
  ];

  return (
    <main className={classes.root}>
      <section className={classes.brand}>
        <div className={cx(classes.blob, classes.blobOne)} />
        <div className={cx(classes.blob, classes.blobTwo)} />
        <div className={cx(classes.blob, classes.blobThree)} />
        <div className={classes.grid} />
        <div className={classes.noise} />
        <div className={classes.brandContent}>
          <LogoImage color="#ffffff" />
          <Typography variant="h2" className={classes.headline}>
            {t('loginHeadline')}
          </Typography>
          <Typography variant="body1" className={classes.tagline}>
            {t('loginTagline')}
          </Typography>
          <div className={classes.features}>
            {features.map((feature) => (
              <div key={feature.key} className={classes.feature}>
                <span className={classes.featureIcon}>{feature.icon}</span>
                <Typography variant="body2">{feature.text}</Typography>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className={classes.mobileBrand}>
        <div className={cx(classes.blob, classes.blobOne)} />
        <LogoImage color="#ffffff" />
      </div>
      <div className={classes.formSide}>
        <div className={classes.formGlow} />
        <Paper className={classes.card} elevation={0}>
          <form>{children}</form>
        </Paper>
      </div>
    </main>
  );
};

export default LoginLayout;
