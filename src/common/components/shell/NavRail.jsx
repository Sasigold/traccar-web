import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import Logo from '../../../resources/images/logo.svg?react';
import { useTranslation } from '../LocalizationProvider';
import useNavItems from './navItems';
import BrandMark from './BrandMark';
import { useShell } from './ShellContext';

const useStyles = makeStyles()((theme, { collapsed }) => ({
  root: {
    gridRow: '1 / -1',
    width: collapsed ? theme.dimensions.railWidthCollapsed : theme.dimensions.railWidth,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    borderInlineEnd: `1px solid ${theme.palette.surface.border}`,
    transition: theme.transitions.create('width', {
      duration: 220,
      easing: theme.tokens.motion.easing.emphasized,
    }),
    overflow: 'hidden',
    zIndex: theme.layers.rail,
    '@media print': {
      display: 'none',
    },
  },
  brand: {
    height: theme.dimensions.topBarHeight,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    paddingInline: collapsed ? 0 : theme.spacing(2.25),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
  },
  logo: {
    height: 30,
    width: 'auto',
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  logoImage: {
    maxHeight: 30,
    maxWidth: 180,
  },
  list: {
    flex: 1,
    paddingTop: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  item: {
    flex: '0 0 auto',
    minHeight: 44,
    marginInline: theme.spacing(1),
    paddingInline: collapsed ? 0 : theme.spacing(1.5),
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: theme.tokens.radius.lg,
    color: theme.palette.text.secondary,
    '&.Mui-selected::before': {
      display: collapsed ? 'none' : 'block',
    },
  },
  itemIcon: {
    minWidth: collapsed ? 0 : 40,
    justifyContent: 'center',
    color: 'inherit',
    '& svg': {
      fontSize: 22,
    },
  },
  label: {
    margin: 0,
    whiteSpace: 'nowrap',
    opacity: collapsed ? 0 : 1,
    width: collapsed ? 0 : 'auto',
    transition: 'opacity 160ms ease',
    '& .MuiListItemText-primary': {
      fontSize: '0.9rem',
      fontWeight: 600,
    },
  },
  footer: {
    padding: theme.spacing(1, 1, 1.5),
    display: 'flex',
    justifyContent: collapsed ? 'center' : 'flex-end',
    borderTop: `1px solid ${theme.palette.surface.border}`,
  },
  collapse: {
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
      color: theme.palette.primary.main,
    },
  },
}));

const NavRail = () => {
  const { railCollapsed: collapsed, toggleRail } = useShell();
  const { classes, theme } = useStyles({ collapsed });
  const t = useTranslation();
  const location = useLocation();
  const items = useNavItems();

  const logo = useSelector((state) => state.session.server.attributes?.logo);

  const rtl = theme.direction === 'rtl';
  const tooltipPlacement = rtl ? 'left' : 'right';
  const pointsStart = !collapsed;
  const CollapseIcon =
    pointsStart !== rtl ? KeyboardDoubleArrowLeftRoundedIcon : KeyboardDoubleArrowRightRoundedIcon;

  return (
    <nav className={`${classes.root} app-rail`} aria-label={t('shellNavigation')}>
      <div className={classes.brand}>
        {collapsed ? (
          <BrandMark size={30} />
        ) : logo ? (
          <img className={classes.logoImage} src={logo} alt="" />
        ) : (
          <Logo className={classes.logo} />
        )}
      </div>
      <List className={classes.list} disablePadding>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = item.match(location.pathname);
          const button = (
            <ListItemButton
              key={item.key}
              component={Link}
              to={item.path}
              selected={selected}
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
        })}
      </List>
      <div className={classes.footer}>
        <Tooltip
          title={collapsed ? t('shellExpandMenu') : t('shellCollapseMenu')}
          placement={tooltipPlacement}
        >
          <IconButton className={classes.collapse} onClick={toggleRail} size="small">
            <CollapseIcon />
          </IconButton>
        </Tooltip>
      </div>
    </nav>
  );
};

export default NavRail;
