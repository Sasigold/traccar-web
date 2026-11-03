import { useMediaQuery, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme, alpha } from '@mui/material/styles';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import TimelineIcon from '@mui/icons-material/Timeline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import LogoImage from './LogoImage';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    height: '100%',
    background: theme.palette.background.default,
  },
  brand: {
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: theme.spacing(4),
    padding: theme.spacing(8),
    width: '46%',
    color: '#ffffff',
    background: `linear-gradient(160deg, #06302e 0%, #0b5e5a 55%, #0f766e 100%)`,
    [theme.breakpoints.down('lg')]: {
      width: '40%',
      padding: theme.spacing(5),
    },
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  glow: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(60px)',
    opacity: 0.55,
    pointerEvents: 'none',
  },
  glowOne: {
    width: 420,
    height: 420,
    top: -120,
    insetInlineEnd: -140,
    background: '#e8732a',
  },
  glowTwo: {
    width: 360,
    height: 360,
    bottom: -140,
    insetInlineStart: -100,
    background: '#6ee7d8',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
    pointerEvents: 'none',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    maxWidth: 480,
  },
  headline: {
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: '-0.01em',
  },
  tagline: {
    opacity: 0.85,
    lineHeight: 1.7,
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(2),
  },
  feature: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 2),
    borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    backdropFilter: 'blur(6px)',
  },
  formSide: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing(5),
    borderRadius: 20,
    boxShadow: `0 20px 60px ${alpha('#06302e', 0.14)}`,
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(3),
      boxShadow: 'none',
      background: 'transparent',
      border: 'none',
    },
  },
}));

const LoginLayout = ({ children }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <main className={classes.root}>
      {desktop && (
        <section className={classes.brand}>
          <div className={`${classes.glow} ${classes.glowOne}`} />
          <div className={`${classes.glow} ${classes.glowTwo}`} />
          <div className={classes.grid} />
          <div className={classes.brandContent}>
            <LogoImage color="#ffffff" />
            <Typography variant="h3" className={classes.headline}>
              מרכז השליטה של הצי שלך
            </Typography>
            <Typography variant="body1" className={classes.tagline}>
              מיקום בזמן אמת, היסטוריית נסיעות, דוחות והתראות – הכל במקום אחד, בעברית מלאה.
            </Typography>
            <div className={classes.features}>
              <div className={classes.feature}>
                <GpsFixedIcon fontSize="small" />
                <Typography variant="body2">מעקב חי אחרי כל רכב ומכשיר</Typography>
              </div>
              <div className={classes.feature}>
                <TimelineIcon fontSize="small" />
                <Typography variant="body2">נגן מסלול והיסטוריה מלאה</Typography>
              </div>
              <div className={classes.feature}>
                <NotificationsActiveIcon fontSize="small" />
                <Typography variant="body2">התראות על מהירות, גיאופנסים והצתה</Typography>
              </div>
            </div>
          </div>
        </section>
      )}
      <div className={classes.formSide}>
        <Paper className={classes.card} elevation={0}>
          <form>{children}</form>
        </Paper>
      </div>
    </main>
  );
};

export default LoginLayout;
