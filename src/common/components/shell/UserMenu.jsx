import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useTranslation } from '../LocalizationProvider';
import { useRestriction } from '../../util/permissions';
import useLogout from '../../util/useLogout';
import useThemeMode from '../../theme/useThemeMode';

const useStyles = makeStyles()((theme) => ({
  trigger: {
    borderRadius: theme.tokens.radius.md,
    padding: 2,
    '&:focus-visible': {
      boxShadow: `0 0 0 3px ${theme.palette.primary.main}40`,
    },
  },
  avatar: {
    width: 34,
    height: 34,
    fontSize: '0.9375rem',
  },
  header: {
    padding: theme.spacing(1, 2, 1.5),
    display: 'flex',
    flexDirection: 'column',
    minWidth: 220,
  },
  logout: {
    color: theme.palette.error.main,
    '& .MuiListItemIcon-root': {
      color: 'inherit',
    },
  },
}));

export const userInitial = (user) =>
  (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

export const UserMenuPopover = ({ anchorEl, open, onClose, up = false }) => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const t = useTranslation();

  const user = useSelector((state) => state.session.user);
  const readonly = useRestriction('readonly');
  const logout = useLogout();
  const { dark, forced, toggle } = useThemeMode();

  const go = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: up ? 'top' : 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: up ? 'bottom' : 'top', horizontal: 'center' }}
    >
      <div className={classes.header}>
        <Typography variant="subtitle2" noWrap>
          {user?.name}
        </Typography>
        <Typography variant="caption" color="textSecondary" noWrap>
          {user?.email}
        </Typography>
      </div>
      <Divider />
      {!readonly && (
        <MenuItem onClick={() => go(`/settings/user/${user.id}`)}>
          <ListItemIcon>
            <PersonRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('settingsProfile')}</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={() => go('/settings/preferences')}>
        <ListItemIcon>
          <TuneRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('sharedPreferences')}</ListItemText>
      </MenuItem>
      {!forced && (
        <MenuItem onClick={toggle}>
          <ListItemIcon>
            <DarkModeRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('settingsDarkMode')}</ListItemText>
          <Switch edge="end" size="small" checked={dark} onChange={() => {}} tabIndex={-1} />
        </MenuItem>
      )}
      <Divider />
      <MenuItem
        className={classes.logout}
        onClick={() => {
          onClose();
          logout();
        }}
      >
        <ListItemIcon>
          <LogoutRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('loginLogout')}</ListItemText>
      </MenuItem>
    </Menu>
  );
};

const UserMenu = () => {
  const { classes } = useStyles();
  const user = useSelector((state) => state.session.user);
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <>
      <ButtonBase
        className={classes.trigger}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-label={user?.name}
      >
        <Avatar className={classes.avatar}>{userInitial(user)}</Avatar>
      </ButtonBase>
      <UserMenuPopover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      />
    </>
  );
};

export default UserMenu;
