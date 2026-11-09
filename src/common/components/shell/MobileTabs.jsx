import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ctaFill } from '../../theme/surfaces';
import { useTranslation } from '../LocalizationProvider';
import useNavItems from './navItems';
import { UserMenuPopover, userInitial } from './UserMenu';
import { useConfirm } from '../confirm/ConfirmProvider';
import { useLeaveGuard } from '../confirm/unsavedChanges';

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
    paddingTop: 8,
    gap: 4,
    color: theme.palette.text.secondary,
    // Active tab: aqua pill behind the icon with ink glyph, label in the text color.
    '& .vf-tab-indicator': {
      width: 56,
      height: 32,
      borderRadius: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: theme.transitions.create('background-color', { duration: 160 }),
    },
    '&:hover .vf-tab-indicator': {
      backgroundColor: theme.palette.action.hover,
    },
    '&.Mui-selected': {
      color: theme.palette.text.primary,
      '& .vf-tab-indicator': {
        ...ctaFill(theme),
      },
    },
    '& .MuiBottomNavigationAction-label': {
      fontSize: '0.6875rem',
      fontWeight: 500,
      '&.Mui-selected': {
        fontSize: '0.6875rem',
        fontWeight: 600,
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
  // ADM-05: unsaved changes are asked about before leaving.
  const leave = useLeaveGuard(useConfirm(), t);
  const items = useNavItems().filter((item) => !item.mobileHidden);

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
              leave(() => navigate(item.path));
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
              icon={<span className="vf-tab-indicator">{icon}</span>}
              value={item.key}
            />
          );
        })}
        <BottomNavigationAction
          className={classes.action}
          label={t('settingsUser')}
          icon={
            <span className="vf-tab-indicator">
              <Avatar className={cx(classes.avatar, !anchorEl && classes.avatarInactive)}>
                {userInitial(user)}
              </Avatar>
            </span>
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
