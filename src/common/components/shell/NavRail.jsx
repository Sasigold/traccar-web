import { Fragment, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Avatar,
  ButtonBase,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import ViperLogo, { ViperMark } from '../brand/ViperLogo';
import { useTranslation } from '../LocalizationProvider';
import useNavItems, { activeNavKey, navSections } from './navItems';
import { useShell } from './ShellContext';
import { UserMenuPopover, userInitial } from './UserMenu';
import { gridPattern } from '../../theme/surfaces';
import { navy, signal } from '../../theme/tokens';

const text = alpha('#ffffff', 0.68);
const textStrong = '#ffffff';

const useStyles = makeStyles()((theme, { collapsed }) => ({
  root: {
    position: 'relative',
    gridRow: '1 / -1',
    width: collapsed ? theme.dimensions.railWidthCollapsed : theme.dimensions.railWidth,
    display: 'flex',
    flexDirection: 'column',
    color: text,
    background:
      theme.palette.mode === 'dark'
        ? `linear-gradient(180deg, #081426 0%, #050c18 100%)`
        : `linear-gradient(180deg, ${navy[900]} 0%, #0a1830 55%, ${navy[950]} 100%)`,
    borderInlineEnd: `1px solid ${theme.palette.mode === 'dark' ? theme.palette.surface.border : 'transparent'}`,
    transition: theme.transitions.create('width', {
      duration: 220,
      easing: theme.tokens.motion.easing.emphasized,
    }),
    overflow: 'hidden',
    zIndex: theme.layers.rail,
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      ...gridPattern(alpha('#ffffff', 0.025), 24),
      maskImage: 'linear-gradient(180deg, black, transparent 40%)',
      pointerEvents: 'none',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      width: 260,
      height: 260,
      top: -150,
      insetInlineStart: -80,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${alpha(signal[400], 0.18)}, transparent 65%)`,
      pointerEvents: 'none',
    },
    '@media print': {
      display: 'none',
    },
  },
  brand: {
    position: 'relative',
    zIndex: 1,
    height: theme.dimensions.topBarHeight,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    paddingInline: collapsed ? 0 : theme.spacing(2.5),
    borderBottom: `1px solid ${alpha('#ffffff', 0.07)}`,
    textDecoration: 'none',
  },
  logoImage: {
    maxHeight: 30,
    maxWidth: 180,
  },
  scroll: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBlock: theme.spacing(1),
    scrollbarColor: `${alpha('#ffffff', 0.15)} transparent`,
  },
  section: {
    height: collapsed ? 17 : 34,
    display: 'flex',
    alignItems: 'flex-end',
    paddingInline: collapsed ? 0 : theme.spacing(2.75),
    paddingBottom: collapsed ? 8 : 6,
    justifyContent: collapsed ? 'center' : 'flex-start',
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: alpha('#ffffff', 0.38),
    whiteSpace: 'nowrap',
    '&::after': collapsed
      ? {
          content: '""',
          width: 20,
          height: 1,
          background: alpha('#ffffff', 0.14),
        }
      : undefined,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  item: {
    flex: '0 0 auto',
    minHeight: 42,
    marginInline: theme.spacing(1.25),
    paddingInline: collapsed ? 0 : theme.spacing(1.5),
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: theme.tokens.radius.md,
    color: text,
    '&:hover': {
      backgroundColor: alpha('#ffffff', 0.06),
      color: textStrong,
    },
    '&.Mui-selected': {
      color: textStrong,
      backgroundColor: alpha(signal[400], 0.12),
      backgroundImage: `linear-gradient(90deg, ${alpha(signal[400], 0.14)}, ${alpha(navy[400], 0.06)})`,
      boxShadow: `inset 0 0 0 1px ${alpha(signal[300], 0.16)}`,
      '& .MuiListItemIcon-root': {
        color: signal[300],
      },
      '& .MuiListItemText-primary': {
        fontWeight: 600,
      },
      '&::before': {
        display: 'block',
        insetInlineStart: collapsed ? 'auto' : -10,
        insetInlineEnd: collapsed ? -10 : 'auto',
        top: '25%',
        bottom: '25%',
        width: 3,
        backgroundColor: signal[400],
        boxShadow: `0 0 12px ${signal[400]}`,
      },
      '&:hover': {
        backgroundColor: alpha(signal[400], 0.16),
      },
    },
  },
  itemIcon: {
    minWidth: collapsed ? 0 : 38,
    justifyContent: 'center',
    color: 'inherit',
    '& svg': {
      fontSize: 21,
    },
  },
  label: {
    margin: 0,
    whiteSpace: 'nowrap',
    opacity: collapsed ? 0 : 1,
    width: collapsed ? 0 : 'auto',
    transition: 'opacity 160ms ease',
    '& .MuiListItemText-primary': {
      fontSize: '0.875rem',
      fontWeight: 500,
    },
  },
  footer: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0, 1.25),
    borderTop: `1px solid ${alpha('#ffffff', 0.07)}`,
  },
  account: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    marginInline: theme.spacing(1.25),
    padding: collapsed ? theme.spacing(0.75, 0) : theme.spacing(0.75, 1),
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: theme.tokens.radius.md,
    textAlign: 'start',
    color: textStrong,
    border: `1px solid ${collapsed ? 'transparent' : alpha('#ffffff', 0.08)}`,
    backgroundColor: collapsed ? 'transparent' : alpha('#ffffff', 0.04),
    transition: 'background-color 140ms ease',
    '&:hover': {
      backgroundColor: alpha('#ffffff', 0.08),
    },
  },
  avatar: {
    width: 32,
    height: 32,
    fontSize: '0.875rem',
    boxShadow: `0 0 0 2px ${alpha(signal[400], 0.35)}`,
  },
  accountText: {
    flex: 1,
    minWidth: 0,
    display: collapsed ? 'none' : 'block',
  },
  accountName: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: 1.3,
  },
  accountEmail: {
    fontSize: '0.6875rem',
    color: alpha('#ffffff', 0.5),
    lineHeight: 1.3,
  },
  accountIcon: {
    display: collapsed ? 'none' : 'block',
    fontSize: 18,
    color: alpha('#ffffff', 0.45),
  },
  collapseRow: {
    display: 'flex',
    justifyContent: collapsed ? 'center' : 'flex-end',
    paddingInline: theme.spacing(1.25),
  },
  collapse: {
    color: alpha('#ffffff', 0.5),
    '&:hover': {
      backgroundColor: alpha('#ffffff', 0.08),
      color: textStrong,
    },
  },
}));

const NavRail = () => {
  const { railCollapsed: collapsed, toggleRail } = useShell();
  const { classes, theme } = useStyles({ collapsed });
  const t = useTranslation();
  const location = useLocation();
  const items = useNavItems();
  const active = activeNavKey(items, location.pathname);

  const logo = useSelector((state) => state.session.server.attributes?.logo);
  const user = useSelector((state) => state.session.user);
  const [anchorEl, setAnchorEl] = useState(null);

  const rtl = theme.direction === 'rtl';
  const tooltipPlacement = rtl ? 'left' : 'right';
  const pointsStart = !collapsed;
  const CollapseIcon =
    pointsStart !== rtl ? KeyboardDoubleArrowLeftRoundedIcon : KeyboardDoubleArrowRightRoundedIcon;

  const renderItem = (item) => {
    const Icon = item.icon;
    const button = (
      <ListItemButton
        key={item.key}
        component={Link}
        to={item.path}
        selected={item.key === active}
        className={classes.item}
      >
        <ListItemIcon className={classes.itemIcon}>
          <Icon />
        </ListItemIcon>
        <ListItemText primary={t(item.titleKey)} className={classes.label} />
      </ListItemButton>
    );
    return collapsed ? (
      <Tooltip key={item.key} title={t(item.titleKey)} placement={tooltipPlacement}>
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

  return (
    <nav className={`${classes.root} app-rail`} aria-label={t('shellNavigation')}>
      <Link to="/" className={classes.brand} aria-label="VIPER">
        {logo ? (
          <img className={classes.logoImage} src={logo} alt="" />
        ) : collapsed ? (
          <ViperMark size={32} tone="light" />
        ) : (
          <ViperLogo height={30} tone="light" />
        )}
      </Link>
      <div className={classes.scroll}>
        {navSections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section.id);
          if (!sectionItems.length) return null;
          return (
            <Fragment key={section.id}>
              <div className={classes.section}>{!collapsed && t(section.titleKey)}</div>
              <List className={classes.list} disablePadding>
                {sectionItems.map(renderItem)}
              </List>
            </Fragment>
          );
        })}
      </div>
      <div className={classes.footer}>
        <List className={classes.list} disablePadding>
          {items.filter((item) => item.section === 'footer').map(renderItem)}
        </List>
        <Tooltip title={collapsed ? user?.name || '' : ''} placement={tooltipPlacement}>
          <ButtonBase className={classes.account} onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar className={classes.avatar}>{userInitial(user)}</Avatar>
            <div className={classes.accountText}>
              <Typography className={classes.accountName} noWrap>
                {user?.name}
              </Typography>
              <Typography className={classes.accountEmail} noWrap>
                {user?.email}
              </Typography>
            </div>
            <UnfoldMoreRoundedIcon className={classes.accountIcon} />
          </ButtonBase>
        </Tooltip>
        <div className={classes.collapseRow}>
          <Tooltip
            title={collapsed ? t('shellExpandMenu') : t('shellCollapseMenu')}
            placement={tooltipPlacement}
          >
            <IconButton className={classes.collapse} onClick={toggleRail} size="small">
              <CollapseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <UserMenuPopover
        up
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      />
    </nav>
  );
};

export default NavRail;
