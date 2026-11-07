import { useEffect, useState } from 'react';
import { Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import dayjs from 'dayjs';
import LogoImage from './LogoImage';
import LiveFleetScene from './LiveFleetScene';
import SyncArc from '../common/components/brand/SyncArc';
import { useTranslation } from '../common/components/LocalizationProvider';
import { brandPanel } from '../common/theme/surfaces';

// Login screen composed like the brand book cover (pages 01 and 16): a flat
// midnight navy panel with the reverse logo, a two-line display headline whose
// second line is aqua, and the Sync Point arc bleeding off the edge. A live,
// schematic fleet preview and a ticking sync clock keep the panel in motion.
// On mobile the panel becomes a navy hero and the form rises over it as a sheet.

const YEAR = new Date().getFullYear();

const FEATURES = [
  'loginFeatureLive',
  'loginFeatureHistory',
  'loginFeatureReports',
  'loginFeatureAlerts',
];

const rise = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: none; }
`;

const fade = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const arcIn = keyframes`
  from { opacity: 0; transform: translate(40px, 40px); }
  to { opacity: 1; transform: none; }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 currentColor; }
  70%, 100% { box-shadow: 0 0 0 7px transparent; }
`;

const stagger = (theme, count, base = 0, step = 70) => {
  const rules = {};
  for (let i = 1; i <= count; i += 1) {
    rules[`& > *${' + *'.repeat(i - 1)}`] = { animationDelay: `${base + (i - 1) * step}ms` };
  }
  return {
    '& > *': {
      animation: `${rise} 560ms ${theme.tokens.motion.easing.emphasized} both`,
    },
    ...rules,
  };
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 52%) minmax(0, 1fr)',
    height: '100%',
    backgroundColor: theme.palette.background.default,
    '@media (prefers-reduced-motion: reduce)': {
      '& *, & *::before, & *::after': {
        animation: 'none !important',
        transition: 'none !important',
      },
    },
    [theme.breakpoints.down('md')]: {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      backgroundColor: theme.palette.brand.navy,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    },
  },

  // ─── Navy brand panel (desktop) ────────────────────────────────────────────
  brand: {
    ...brandPanel(),
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
    padding: theme.spacing(6, 7),
    [theme.breakpoints.down('lg')]: {
      padding: theme.spacing(5),
    },
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  topRow: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    animation: `${fade} 600ms ease-out both`,
  },
  syncChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.tokens.radius.pill,
    border: `1px solid ${theme.palette.chrome.border}`,
    backgroundColor: theme.palette.chrome.backgroundHover,
    color: theme.palette.brand.paper,
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.06em',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.brand.aqua,
    color: alpha(theme.palette.brand.aqua, 0.55),
    animation: `${pulse} 1.8s ease-out infinite`,
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    marginTop: 'clamp(8px, 4vh, 56px)',
    ...stagger(theme, 2, 120, 140),
  },
  headline: {
    fontWeight: 400,
    lineHeight: 1.08,
    letterSpacing: '-0.01em',
    fontSize: 'clamp(2.25rem, 3.9vw, 4rem)',
    color: theme.palette.brand.paper,
  },
  headlineLine: {
    display: 'block',
    whiteSpace: 'nowrap',
    animation: `${rise} 700ms ${theme.tokens.motion.easing.emphasized} both`,
  },
  headlineAccent: {
    color: theme.palette.brand.aqua,
    animationDelay: '160ms',
  },
  tagline: {
    color: theme.palette.brand.ice,
    opacity: 0.86,
    lineHeight: 1.7,
    fontSize: '1.0625rem',
    maxWidth: 440,
  },
  preview: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minHeight: 220,
    maxHeight: 400,
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.chrome.border}`,
    backgroundColor: theme.palette.brand.ink,
    overflow: 'hidden',
    animation: `${rise} 800ms ${theme.tokens.motion.easing.emphasized} 360ms both`,
  },
  previewScene: {
    position: 'absolute',
    inset: 0,
  },
  previewBar: {
    position: 'absolute',
    insetInline: theme.spacing(2),
    bottom: theme.spacing(2),
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  feature: {
    padding: theme.spacing(0.75, 1.75),
    borderRadius: theme.tokens.radius.pill,
    border: `1px solid ${theme.palette.chrome.border}`,
    backgroundColor: theme.palette.brand.navy,
    color: theme.palette.chrome.text,
    fontSize: '0.8125rem',
    fontWeight: 500,
    transition: `background-color ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.standard}, color ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.standard}, border-color ${theme.tokens.motion.duration.slow}ms`,
  },
  featureActive: {
    backgroundColor: theme.palette.chrome.activeBackground,
    borderColor: theme.palette.chrome.activeBackground,
    color: theme.palette.chrome.activeText,
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
    animation: `${fade} 600ms ease-out 600ms both`,
  },
  arc: {
    animation: `${arcIn} 1100ms ${theme.tokens.motion.easing.emphasized} 200ms both`,
  },

  // ─── Navy hero (mobile) ────────────────────────────────────────────────────
  mobileBrand: {
    display: 'none',
    [theme.breakpoints.down('md')]: {
      ...brandPanel(),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2.5),
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      minHeight: 320,
      padding: theme.spacing(3, 3, 7),
      paddingTop: `calc(${theme.spacing(3)} + env(safe-area-inset-top, 0px))`,
    },
  },
  mobileScene: {
    position: 'absolute',
    inset: 0,
    opacity: 0.4,
    animation: `${fade} 900ms ease-out both`,
  },
  mobileContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    marginTop: 'auto',
  },
  mobileHeadline: {
    fontWeight: 400,
    lineHeight: 1.08,
    fontSize: '2.25rem',
    color: theme.palette.brand.paper,
  },

  // ─── Form side ─────────────────────────────────────────────────────────────
  formSide: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(10, 3, 3),
    overflow: 'auto',
    [theme.breakpoints.down('md')]: {
      flex: 1,
      justifyContent: 'flex-start',
      overflow: 'visible',
      marginTop: theme.spacing(-4),
      padding: theme.spacing(1, 2, 3),
      backgroundColor: theme.palette.background.default,
      borderStartStartRadius: theme.tokens.radius.xxl,
      borderStartEndRadius: theme.tokens.radius.xxl,
      position: 'relative',
      zIndex: 1,
      animation: `${rise} 640ms ${theme.tokens.motion.easing.emphasized} 120ms both`,
    },
  },
  grabber: {
    display: 'none',
    [theme.breakpoints.down('md')]: {
      display: 'block',
      width: 40,
      height: 4,
      borderRadius: theme.tokens.radius.pill,
      backgroundColor: theme.palette.surface.borderStrong,
      marginTop: theme.spacing(0.5),
    },
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 460,
    padding: theme.spacing(5),
    borderRadius: theme.tokens.radius.xxl,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    boxShadow: theme.shadows[3],
    animation: `${rise} 640ms ${theme.tokens.motion.easing.emphasized} 80ms both`,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 1),
      maxWidth: 520,
      border: 'none',
      boxShadow: 'none',
      backgroundColor: 'transparent',
      animation: 'none',
    },
  },
  footer: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    animation: `${fade} 600ms ease-out 700ms both`,
    [theme.breakpoints.down('md')]: {
      marginTop: 'auto',
    },
  },
}));

const useSyncClock = () => {
  const [now, setNow] = useState(() => dayjs());
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now.format('HH:mm:ss');
};

const useCycle = (length, interval) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const timer = setInterval(() => setIndex((value) => (value + 1) % length), interval);
    return () => clearInterval(timer);
  }, [length, interval]);
  return index;
};

const SyncChip = ({ classes }) => {
  const t = useTranslation();
  const time = useSyncClock();
  return (
    <span className={classes.syncChip} dir="ltr">
      <span className={classes.syncDot} />
      {`${t('loginSynced')} / ${time}`}
    </span>
  );
};

const LoginLayout = ({ children, options }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const activeFeature = useCycle(FEATURES.length, 2600);

  return (
    <main className={classes.root}>
      {options}
      <section className={classes.brand}>
        <div className={classes.topRow}>
          <LogoImage variant="reverse" height={44} />
          <SyncChip classes={classes} />
        </div>
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
        <div className={classes.preview}>
          <LiveFleetScene className={classes.previewScene} />
          <div className={classes.previewBar}>
            {FEATURES.map((key, index) => (
              <span
                key={key}
                className={cx(classes.feature, index === activeFeature && classes.featureActive)}
              >
                {t(key)}
              </span>
            ))}
          </div>
        </div>
        {/* Brand signature: always Latin, left to right, bottom-left (inline dir, not
            CSS direction, which the RTL style plugin would flip). */}
        <span className={classes.brandLine} dir="ltr">
          {t('loginBrandLine')}
        </span>
        <SyncArc
          className={classes.arc}
          style={{ right: -36, bottom: 12, width: 'clamp(140px, 13vw, 190px)', height: 'auto' }}
        />
      </section>

      <section className={classes.mobileBrand}>
        <LiveFleetScene className={classes.mobileScene} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <LogoImage variant="reverse" height={34} />
        </div>
        <div className={classes.mobileContent}>
          <Typography variant="h1" component="p" className={classes.mobileHeadline}>
            <span className={classes.headlineLine}>{t('loginHeadline')}</span>
            <span className={cx(classes.headlineLine, classes.headlineAccent)}>
              {t('loginHeadlineAccent')}
            </span>
          </Typography>
          <SyncChip classes={classes} />
        </div>
      </section>

      <div className={classes.formSide}>
        <span className={classes.grabber} />
        <Paper className={classes.card} elevation={0}>
          <form>{children}</form>
        </Paper>
        <span className={classes.footer} dir="ltr">
          {`© ${YEAR} viper fleet`}
        </span>
      </div>
    </main>
  );
};

export default LoginLayout;
