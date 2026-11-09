import { useSelector } from 'react-redux';
import { ButtonBase, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import BrandLogo from '../brand/BrandLogo';
import useFeatures from '../../util/useFeatures';
import { focusRing } from '../../theme/surfaces';
import { useTranslation } from '../LocalizationProvider';
import { useShell } from './ShellContext';
import SocketStatusPill from './SocketStatusPill';
import EnvironmentBadge from './EnvironmentBadge';
import NotificationsButton from './NotificationsButton';
import ThemeToggle from './ThemeToggle';
import LanguageMenu from './LanguageMenu';
import UserMenu from './UserMenu';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: theme.dimensions.topBarHeight,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    paddingInline: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    zIndex: theme.layers.topBar,
    [theme.breakpoints.down('md')]: {
      // viewport-fit=cover draws the page under the iOS status bar; pad the bar
      // so the status bar sits on its solid paper fill instead of blurred content.
      height: `calc(${theme.dimensions.topBarHeightMobile}px + env(safe-area-inset-top, 0px))`,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingInline: theme.spacing(1),
    },
    '@media print': {
      display: 'none',
    },
  },
  logo: {
    marginInlineStart: theme.spacing(0.5),
  },
  logoImage: {
    maxHeight: 24,
    maxWidth: 140,
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: 300,
    height: 38,
    paddingInline: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    backgroundColor: theme.palette.surface.sunken,
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
    fontFamily: theme.typography.fontFamily,
    textAlign: 'start',
    transition: 'border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease',
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.45),
      backgroundColor: theme.palette.background.paper,
    },
    '&:focus-visible': {
      boxShadow: focusRing(theme),
    },
  },
  triggerText: {
    flex: 1,
    color: theme.palette.surface.textSecondaryOnTint,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    height: 20,
    padding: '0 6px',
    borderRadius: theme.tokens.radius.xs,
    fontSize: '0.6875rem',
    fontWeight: 700,
    fontFamily: theme.tokens.font.mono,
    color: theme.palette.text.secondary,
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    backgroundColor: theme.palette.background.paper,
  },
  spacer: {
    flex: 1,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
}));

const TopBar = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const features = useFeatures();
  const { openPalette, chromeVisible } = useShell();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const logo = useSelector((state) => state.session.server.attributes?.logo);

  return (
    <header className={`${classes.root} app-topbar`}>
      {!desktop &&
        (logo ? (
          <img className={classes.logoImage} src={logo} alt="" />
        ) : (
          <BrandLogo
            className={classes.logo}
            variant={theme.palette.mode === 'dark' ? 'reverse' : 'primary'}
            height={26}
          />
        ))}
      {desktop ? (
        <ButtonBase className={classes.trigger} onClick={openPalette}>
          <SearchRoundedIcon fontSize="small" />
          <span className={classes.triggerText}>{t('shellCommandPalette')}</span>
          <span className={classes.kbd}>Ctrl K</span>
        </ButtonBase>
      ) : (
        <div className={classes.spacer} />
      )}
      {desktop && <div className={classes.spacer} />}
      <div className={classes.actions}>
        {!desktop && (
          <Tooltip title={t('shellCommandPalette')}>
            <IconButton onClick={openPalette}>
              <SearchRoundedIcon />
            </IconButton>
          </Tooltip>
        )}
        <EnvironmentBadge />
        <SocketStatusPill />
        {/* LIV-09: on a phone the alerts are a tab, and the color theme is in "More". Without the
            tabs (disableTabs) the bar keeps them. */}
        {!features.disableEvents && (desktop || !chromeVisible) && <NotificationsButton />}
        {(desktop || !chromeVisible) && <ThemeToggle />}
        {desktop && <LanguageMenu />}
        {desktop && <UserMenu />}
      </div>
    </header>
  );
};

export default TopBar;
