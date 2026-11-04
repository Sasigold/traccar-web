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
  Switch,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import BrandLogo from '../brand/BrandLogo';
import { useTranslation } from '../LocalizationProvider';
import { useRestriction } from '../../util/permissions';
import useLogout from '../../util/useLogout';
import useThemeMode from '../../theme/useThemeMode';
import useNavItems from './navItems';
import { userInitial } from './UserMenu';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: 300,
    maxWidth: '85vw',
    display: 'flex',
    flexDirection: 'column',
  },
  brand: {
    height: `calc(${theme.dimensions.topBarHeightMobile}px + env(safe-area-inset-top, 0px))`,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    display: 'flex',
    alignItems: 'center',
    paddingInline: theme.spacing(2.5),
    backgroundColor: theme.palette.chrome.background,
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
        <BrandLogo variant="reverse" height={30} />
      </div>
      <List component="nav" aria-label={t('shellNavigation')} className={classes.list}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <ListItemButton
              key={item.key}
              component={Link}
              to={item.path}
              selected={item.match(location.pathname)}
              aria-current={item.match(location.pathname) ? 'page' : undefined}
              onClick={onClose}
            >
              <ListItemIcon>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={t(item.titleKey)} />
            </ListItemButton>
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
