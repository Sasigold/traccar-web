import { Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import LogoImage from './LogoImage';
import LoginHero from './LoginHero';
import { useTranslation } from '../common/components/LocalizationProvider';
import { glass, gridPattern, meshBackground } from '../common/theme/surfaces';
import { navy, signal } from '../common/theme/tokens';

const drift = keyframes`
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(-6%, 8%, 0) scale(1.08); }
  100% { transform: translate3d(5%, -6%, 0) scale(0.96); }
`;

const noise =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const currentYear = new Date().getFullYear();

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
    justifyContent: 'space-between',
    gap: theme.spacing(3),
    padding: theme.spacing(5, 7),
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
    background: navy[500],
    animation: `${drift} 22s ease-in-out infinite alternate`,
  },
  blobTwo: {
    width: 440,
    height: 440,
    bottom: -180,
    insetInlineStart: -140,
    background: signal[500],
    opacity: 0.55,
    animation: `${drift} 26s ease-in-out infinite alternate-reverse`,
  },
  blobThree: {
    width: 360,
    height: 360,
    top: '38%',
    insetInlineStart: '36%',
    background: navy[600],
    opacity: 0.4,
    animation: `${drift} 30s ease-in-out infinite alternate`,
  },
  grid: {
    position: 'absolute',
    inset: 0,
    ...gridPattern(alpha('#ffffff', 0.05), 40),
    maskImage: 'radial-gradient(ellipse at 50% 45%, black 25%, transparent 75%)',
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
  brandTop: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  motto: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    letterSpacing: '0.04em',
    color: alpha('#ffffff', 0.72),
    paddingInlineStart: theme.spacing(2),
    borderInlineStart: `1px solid ${alpha('#ffffff', 0.2)}`,
  },
  status: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    height: 30,
    paddingInline: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.pill,
    fontSize: '0.75rem',
    fontWeight: 600,
    color: signal[200],
    background: alpha(signal[400], 0.1),
    border: `1px solid ${alpha(signal[400], 0.3)}`,
    whiteSpace: 'nowrap',
    '&::before': {
      content: '""',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: signal[400],
      boxShadow: `0 0 0 4px ${alpha(signal[400], 0.2)}`,
    },
  },
  heroWrap: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'center',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 560,
  },
  headline: {
    fontWeight: 800,
    lineHeight: 1.12,
    letterSpacing: '-0.02em',
    fontSize: 'clamp(1.875rem, 2.8vw, 2.625rem)',
    '& em': {
      fontStyle: 'normal',
      backgroundImage: `linear-gradient(90deg, ${signal[300]}, ${navy[300]})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    },
  },
  tagline: {
    opacity: 0.8,
    lineHeight: 1.7,
    fontSize: '1rem',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(1.25),
    marginTop: theme.spacing(1),
    [theme.breakpoints.down('lg')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  feature: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    lineHeight: 1.45,
    [theme.breakpoints.down('lg')]: {
      flexDirection: 'row',
      alignItems: 'center',
    },
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
    color: signal[200],
    background: `linear-gradient(135deg, ${alpha(signal[400], 0.25)}, ${alpha(navy[400], 0.2)})`,
    border: `1px solid ${alpha(signal[300], 0.25)}`,
    '& svg': {
      fontSize: 20,
    },
  },
  mobileBrand: {
    display: 'none',
    [theme.breakpoints.down('md')]: {
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'column',
      gap: theme.spacing(1),
      justifyContent: 'center',
      minHeight: 150,
      padding: theme.spacing(3),
      color: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
      ...meshBackground(),
    },
  },
  mobileBrandContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  formSide: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
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
  formGrid: {
    position: 'absolute',
    inset: 0,
    ...gridPattern(
      alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.05),
      40,
    ),
    maskImage: 'radial-gradient(ellipse at 50% 40%, black 10%, transparent 65%)',
    pointerEvents: 'none',
  },
  footer: {
    position: 'absolute',
    insetInline: 0,
    bottom: theme.spacing(2),
    textAlign: 'center',
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    [theme.breakpoints.down('md')]: {
      position: 'static',
      marginTop: theme.spacing(3),
    },
  },
  formColumn: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    [theme.breakpoints.down('sm')]: {
      maxWidth: 'none',
    },
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
        <div className={classes.brandTop}>
          <LogoImage tone="light" height={44} />
          <span className={classes.status}>{t('loginSystemStatus')}</span>
        </div>
        <div className={classes.heroWrap}>
          <LoginHero />
        </div>
        <div className={classes.brandContent}>
          <Typography className={classes.motto}>{t('loginMotto')}</Typography>
          <Typography variant="h2" className={classes.headline}>
            {t('loginHeadline')} <em>{t('loginHeadlineAccent')}</em>
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
        <div className={classes.grid} />
        <div className={classes.mobileBrandContent}>
          <LogoImage tone="light" height={44} />
          <Typography className={classes.motto} style={{ border: 0, padding: 0 }}>
            {t('loginMotto')}
          </Typography>
        </div>
      </div>
      <div className={classes.formSide}>
        <div className={classes.formGlow} />
        <div className={classes.formGrid} />
        <div className={classes.formColumn}>
          <Paper className={classes.card} elevation={0}>
            <form>{children}</form>
          </Paper>
        </div>
        <Typography component="div" className={classes.footer}>
          {`© ${currentYear} VIPER · ${t('loginMotto')}`}
        </Typography>
      </div>
    </main>
  );
};

export default LoginLayout;
