import { useSelector } from 'react-redux';
import { ButtonBase, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ViperLogo from '../brand/ViperLogo';
import useFeatures from '../../util/useFeatures';
import { useTranslation } from '../LocalizationProvider';
import { useShell } from './ShellContext';
import SocketStatusPill from './SocketStatusPill';
import NotificationsButton from './NotificationsButton';
import ThemeToggle from './ThemeToggle';
import LanguageMenu from './LanguageMenu';
import UserMenu from './UserMenu';
import FleetPulse from './FleetPulse';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: theme.dimensions.topBarHeight,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    paddingInline: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.88),
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    zIndex: theme.layers.topBar,
    [theme.breakpoints.down('md')]: {
      height: theme.dimensions.topBarHeightMobile,
      paddingInline: theme.spacing(1),
    },
    '@media print': {
      display: 'none',
    },
  },
  logo: {
    marginInlineStart: theme.spacing(0.5),
    flexShrink: 0,
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
      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
    },
  },
  triggerText: {
    flex: 1,
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
    borderRadius: 6,
    fontSize: '0.6875rem',
    fontWeight: 700,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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

const TopBar = ({ onOpenDrawer }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const features = useFeatures();
  const { openPalette, chromeVisible } = useShell();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const logo = useSelector((state) => state.session.server.attributes?.logo);

  return (
    <header className={`${classes.root} app-topbar`}>
      {!desktop && chromeVisible && (
        <IconButton edge="start" onClick={onOpenDrawer} aria-label={t('shellOpenMenu')}>
          <MenuRoundedIcon />
        </IconButton>
      )}
      {!desktop &&
        (logo ? (
          <img className={classes.logoImage} src={logo} alt="" />
        ) : (
          <ViperLogo height={26} className={classes.logo} />
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
      {desktop && <FleetPulse />}
      {desktop && <div className={classes.spacer} />}
      <div className={classes.actions}>
        {!desktop && (
          <Tooltip title={t('shellCommandPalette')}>
            <IconButton onClick={openPalette}>
              <SearchRoundedIcon />
            </IconButton>
          </Tooltip>
        )}
        <SocketStatusPill />
        {!features.disableEvents && <NotificationsButton />}
        <ThemeToggle />
        {desktop && <LanguageMenu />}
        {desktop && !chromeVisible && <UserMenu />}
      </div>
    </header>
  );
};

export default TopBar;
