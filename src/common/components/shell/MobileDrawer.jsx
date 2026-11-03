import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Switch,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ViperLogo from '../brand/ViperLogo';
import { useTranslation } from '../LocalizationProvider';
import { useRestriction } from '../../util/permissions';
import useLogout from '../../util/useLogout';
import useThemeMode from '../../theme/useThemeMode';
import useNavItems, { activeNavKey, navSections } from './navItems';
import { userInitial } from './UserMenu';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: 300,
    maxWidth: '85vw',
    display: 'flex',
    flexDirection: 'column',
  },
  brand: {
    height: theme.dimensions.topBarHeightMobile,
    display: 'flex',
    alignItems: 'center',
    paddingInline: theme.spacing(2.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
  },
  list: {
    paddingTop: theme.spacing(1),
    flex: 1,
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
  },
  userText: {
    minWidth: 0,
    flex: 1,
  },
  logout: {
    color: theme.palette.error.main,
    '& .MuiListItemIcon-root': { color: 'inherit' },
  },
}));

const MobileDrawer = ({ open, onClose }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const location = useLocation();
  const items = useNavItems();
  const active = activeNavKey(items, location.pathname);
  const user = useSelector((state) => state.session.user);
  const readonly = useRestriction('readonly');
  const logout = useLogout();
  const { dark, forced, toggle } = useThemeMode();

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { className: classes.paper } }}
    >
      <div className={classes.brand}>
        <ViperLogo height={30} />
      </div>
      <List className={classes.list}>
        {[...navSections, { id: 'footer' }].map((section) => {
          const sectionItems = items.filter((item) => item.section === section.id);
          if (!sectionItems.length) return null;
          return (
            <Fragment key={section.id}>
              {section.titleKey && <ListSubheader>{t(section.titleKey)}</ListSubheader>}
              {sectionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <ListItemButton
                    key={item.key}
                    component={Link}
                    to={item.path}
                    selected={item.key === active}
                    onClick={onClose}
                  >
                    <ListItemIcon>
                      <Icon />
                    </ListItemIcon>
                    <ListItemText primary={t(item.titleKey)} />
                  </ListItemButton>
                );
              })}
            </Fragment>
          );
        })}
        <Divider sx={{ my: 1 }} />
        {!readonly && (
          <ListItemButton component={Link} to={`/settings/user/${user.id}`} onClick={onClose}>
            <ListItemIcon>
              <PersonRoundedIcon />
            </ListItemIcon>
            <ListItemText primary={t('settingsProfile')} />
          </ListItemButton>
        )}
        {!forced && (
          <ListItemButton onClick={toggle}>
            <ListItemIcon>
              <DarkModeRoundedIcon />
            </ListItemIcon>
            <ListItemText primary={t('settingsDarkMode')} />
            <Switch edge="end" size="small" checked={dark} onChange={() => {}} tabIndex={-1} />
          </ListItemButton>
        )}
        <ListItemButton
          className={classes.logout}
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
      <Divider />
      <div className={classes.user}>
        <Avatar>{userInitial(user)}</Avatar>
        <div className={classes.userText}>
          <Typography variant="subtitle2" noWrap>
            {user?.name}
          </Typography>
          <Typography variant="caption" color="textSecondary" noWrap display="block">
            {user?.email}
          </Typography>
        </div>
      </div>
    </Drawer>
  );
};

export default MobileDrawer;
