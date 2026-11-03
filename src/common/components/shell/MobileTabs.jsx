import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';
import useNavItems from './navItems';
import { UserMenuPopover, userInitial } from './UserMenu';

const useStyles = makeStyles()((theme) => ({
  root: {
    flexShrink: 0,
    height: `calc(${theme.dimensions.mobileTabsHeight}px + env(safe-area-inset-bottom, 0px))`,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: theme.layers.mobileTabs,
    '@media print': {
      display: 'none',
    },
  },
  action: {
    minWidth: 0,
    paddingTop: 10,
    '& .MuiBottomNavigationAction-label': {
      fontSize: '0.6875rem',
      '&.Mui-selected': {
        fontSize: '0.6875rem',
      },
    },
  },
  avatar: {
    width: 24,
    height: 24,
    fontSize: '0.75rem',
  },
  avatarInactive: {
    backgroundImage: 'none',
    backgroundColor: theme.palette.text.secondary,
  },
}));

const MobileTabs = () => {
  const { classes, cx } = useStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation();
  const items = useNavItems();

  const user = useSelector((state) => state.session.user);
  const socket = useSelector((state) => state.session.socket);

  const [anchorEl, setAnchorEl] = useState(null);

  const current = items.find((item) => item.match(location.pathname))?.key ?? null;

  return (
    <>
      <BottomNavigation
        component="nav"
        aria-label={t('shellNavigation')}
        className={`${classes.root} app-tabs`}
        value={current}
        onChange={(event, value) => {
          if (value === 'account') {
            setAnchorEl(event.currentTarget);
          } else {
            const item = items.find((it) => it.key === value);
            if (item) {
              navigate(item.path);
            }
          }
        }}
        showLabels
      >
        {items.map((item) => {
          const Icon = item.icon;
          const icon =
            item.key === 'map' ? (
              <Badge color="error" variant="dot" overlap="circular" invisible={socket !== false}>
                <Icon />
              </Badge>
            ) : (
              <Icon />
            );
          return (
            <BottomNavigationAction
              key={item.key}
              className={classes.action}
              label={t(item.titleKey)}
              icon={icon}
              value={item.key}
            />
          );
        })}
        <BottomNavigationAction
          className={classes.action}
          label={t('settingsUser')}
          icon={
            <Avatar className={cx(classes.avatar, !anchorEl && classes.avatarInactive)}>
              {userInitial(user)}
            </Avatar>
          }
          value="account"
        />
      </BottomNavigation>
      <UserMenuPopover
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      />
    </>
  );
};

export default MobileTabs;
