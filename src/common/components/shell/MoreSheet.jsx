import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  Collapse,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useLocalization, useTranslation } from '../LocalizationProvider';
import { useRestriction } from '../../util/permissions';
import useLogout from '../../util/useLogout';
import useThemeMode from '../../theme/useThemeMode';
import { userInitial } from './UserMenu';

const useStyles = makeStyles()((theme) => ({
  paper: {
    // The navy of the navigation, in both modes (brand book page 14).
    backgroundColor: theme.palette.chrome.background,
    color: theme.palette.chrome.text,
    borderStartStartRadius: theme.tokens.radius.xl,
    borderStartEndRadius: theme.tokens.radius.xl,
    maxHeight: '85%',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    margin: theme.spacing(1, 'auto', 0),
    backgroundColor: theme.palette.chrome.border,
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2.5),
    borderBottom: `1px solid ${theme.palette.chrome.border}`,
  },
  userText: {
    minWidth: 0,
    flex: 1,
  },
  email: {
    color: theme.palette.chrome.text,
    display: 'block',
  },
  name: {
    color: theme.palette.chrome.textStrong,
  },
  list: {
    padding: theme.spacing(1, 1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  item: {
    minHeight: 48,
    borderRadius: theme.tokens.radius.md,
    color: theme.palette.chrome.text,
    '& .MuiListItemIcon-root': {
      color: 'inherit',
      minWidth: 40,
    },
    '& .MuiListItemText-secondary': {
      color: theme.palette.chrome.text,
    },
    '&:hover': {
      backgroundColor: theme.palette.chrome.backgroundHover,
      color: theme.palette.chrome.textStrong,
    },
    // The active item is the aqua pill with ink text, as in the rail.
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor: theme.palette.chrome.activeBackground,
      color: theme.palette.chrome.activeText,
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.chrome.activeBackground}`,
      outlineOffset: 2,
    },
  },
  nested: {
    paddingInlineStart: theme.spacing(7),
  },
  divider: {
    height: 1,
    margin: theme.spacing(0.5, 1),
    backgroundColor: theme.palette.chrome.border,
  },
  expand: {
    transition: theme.transitions.create('transform'),
  },
  expanded: {
    transform: 'rotate(180deg)',
  },
}));

// LIV-09: "More" on a phone: the destinations that are not tabs, the language, the color theme,
// the account and signing out, in one navy sheet from the bottom. It replaces the side menu,
// which repeated the tabs.
const MoreSheet = ({ open, onClose, items }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const location = useLocation();
  const user = useSelector((state) => state.session.user);
  const readonly = useRestriction('readonly');
  const logout = useLogout();
  const { dark, forced, toggle } = useThemeMode();
  const { languages, language, setLocalLanguage } = useLocalization();
  const remoteLanguage = useSelector(
    (state) =>
      state.session.user?.attributes?.language || state.session.server?.attributes?.language,
  );
  const [languagesOpen, setLanguagesOpen] = useState(false);

  const link = (to, icon, label, selected) => (
    <ListItemButton
      key={to}
      component={Link}
      to={to}
      className={classes.item}
      selected={selected}
      aria-current={selected ? 'page' : undefined}
      onClick={onClose}
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  );

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { className: classes.paper, 'aria-label': t('shellMore') } }}
    >
      <div className={classes.handle} aria-hidden />
      <div className={classes.user}>
        <Avatar>{userInitial(user)}</Avatar>
        <div className={classes.userText}>
          <Typography variant="subtitle2" noWrap className={classes.name}>
            {user?.name}
          </Typography>
          <Typography variant="caption" noWrap className={classes.email}>
            {user?.email}
          </Typography>
        </div>
      </div>
      <List component="nav" aria-label={t('shellMore')} className={classes.list}>
        {items.map((item) => {
          const Icon = item.icon;
          return link(item.path, <Icon />, t(item.titleKey), item.match(location.pathname));
        })}
        {items.length > 0 && <div className={classes.divider} role="separator" />}
        {!readonly &&
          link(
            `/settings/user/${user.id}`,
            <PersonRoundedIcon />,
            t('settingsProfile'),
            location.pathname === `/settings/user/${user.id}`,
          )}
        {link(
          '/settings/preferences',
          <TuneRoundedIcon />,
          t('sharedPreferences'),
          location.pathname === '/settings/preferences',
        )}
        {!remoteLanguage && (
          <>
            <ListItemButton
              className={classes.item}
              onClick={() => setLanguagesOpen((value) => !value)}
              aria-expanded={languagesOpen}
            >
              <ListItemIcon>
                <TranslateRoundedIcon />
              </ListItemIcon>
              <ListItemText primary={t('loginLanguage')} secondary={languages[language]?.name} />
              <ExpandMoreRoundedIcon
                className={cx(classes.expand, languagesOpen && classes.expanded)}
              />
            </ListItemButton>
            <Collapse in={languagesOpen} unmountOnExit>
              {Object.entries(languages).map(([code, values]) => (
                <ListItemButton
                  key={code}
                  className={cx(classes.item, classes.nested)}
                  selected={code === language}
                  lang={code}
                  onClick={() => {
                    setLocalLanguage(code);
                    setLanguagesOpen(false);
                  }}
                >
                  <ListItemText primary={values.name} />
                </ListItemButton>
              ))}
            </Collapse>
          </>
        )}
        {!forced && (
          <ListItemButton
            className={classes.item}
            onClick={toggle}
            role="switch"
            aria-checked={dark}
          >
            <ListItemIcon>
              <DarkModeRoundedIcon />
            </ListItemIcon>
            <ListItemText primary={t('settingsDarkMode')} />
            <Switch
              edge="end"
              size="small"
              checked={dark}
              tabIndex={-1}
              slotProps={{ input: { 'aria-hidden': true } }}
            />
          </ListItemButton>
        )}
        <div className={classes.divider} role="separator" />
        <ListItemButton
          className={classes.item}
          onClick={() => {
            onClose();
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon />
          </ListItemIcon>
          <ListItemText primary={t('loginLogout')} />
        </ListItemButton>
      </List>
    </Drawer>
  );
};

export default MoreSheet;
