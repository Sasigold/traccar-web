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
import { makeStyles } from 'tss-react/mui';
import KeyboardDoubleArrowLeftRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRoundedIcon from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import BrandLogo, { BrandSymbol } from '../brand/BrandLogo';
import { useTranslation } from '../LocalizationProvider';
import useNavItems from './navItems';
import { useShell } from './ShellContext';
import { prefetchRoute } from '../../util/prefetchRoute';

const useStyles = makeStyles()((theme, { collapsed }) => ({
  root: {
    gridRow: '1 / -1',
    width: collapsed ? theme.dimensions.railWidthCollapsed : theme.dimensions.railWidth,
    display: 'flex',
    flexDirection: 'column',
    // Navy navigation with an aqua active item (brand book page 14), in both modes.
    backgroundColor: theme.palette.chrome.background,
    color: theme.palette.chrome.text,
    borderInlineEnd: `1px solid ${theme.palette.chrome.border}`,
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
    paddingInline: collapsed ? 0 : theme.spacing(2.5),
  },
  logoImage: {
    maxHeight: 30,
    maxWidth: 180,
  },
  list: {
    flex: 1,
    padding: collapsed ? theme.spacing(1.25, 0) : theme.spacing(1.25, 1.5),
    display: 'flex',
    flexDirection: 'column',
    // Collapsed: every item sits on the rail's center line.
    alignItems: collapsed ? 'center' : 'stretch',
    gap: 4,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  item: {
    flex: '0 0 auto',
    width: collapsed ? 48 : 'auto',
    height: collapsed ? 48 : 44,
    minHeight: 0,
    gap: theme.spacing(1.5),
    paddingInline: collapsed ? 0 : theme.spacing(1.5),
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: theme.tokens.radius.md,
    color: theme.palette.chrome.text,
    '&:hover': {
      backgroundColor: theme.palette.chrome.backgroundHover,
      color: theme.palette.chrome.textStrong,
    },
    '&.Mui-selected, &.Mui-selected:hover': {
      backgroundColor: theme.palette.chrome.activeBackground,
      color: theme.palette.chrome.activeText,
      '& .MuiListItemIcon-root': {
        color: theme.palette.chrome.activeText,
      },
    },
    '&.Mui-selected::before': {
      display: 'none',
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${theme.palette.chrome.activeBackground}`,
      outlineOffset: 2,
    },
  },
  listItem: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: collapsed ? 'center' : 'stretch',
  },
  itemIcon: {
    minWidth: 0,
    width: 24,
    justifyContent: 'center',
    color: 'inherit',
    '& svg': {
      fontSize: 22,
    },
  },
  label: {
    margin: 0,
    whiteSpace: 'nowrap',
    '& .MuiListItemText-primary': {
      fontSize: '0.9375rem',
      fontWeight: 500,
    },
  },
  footer: {
    padding: collapsed ? theme.spacing(1, 0, 1.5) : theme.spacing(1, 1.5, 1.5),
    display: 'flex',
    justifyContent: collapsed ? 'center' : 'flex-end',
    borderTop: `1px solid ${theme.palette.chrome.border}`,
  },
  collapse: {
    color: theme.palette.chrome.text,
    '&:hover': {
      backgroundColor: theme.palette.chrome.backgroundHover,
      color: theme.palette.chrome.textStrong,
    },
  },
}));

const NavRail = () => {
  const { railCollapsed: collapsed, toggleRail } = useShell();
  const { classes, theme } = useStyles({ collapsed });
  const t = useTranslation();
  const location = useLocation();
  const items = useNavItems().filter((item) => !item.phoneOnly);

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
          <BrandSymbol size={30} color={theme.palette.brand.aqua} title="viper fleet" />
        ) : logo ? (
          <img className={classes.logoImage} src={logo} alt="" />
        ) : (
          <BrandLogo variant="reverse" height={34} />
        )}
      </div>
      {/* LIV-16: a plain list inside the one navigation landmark. */}
      <List className={classes.list} disablePadding>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = item.match(location.pathname);
          const button = (
            <ListItemButton
              component={Link}
              to={item.path}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              className={classes.item}
              // LIV-16: the screen starts loading on hover or focus.
              onPointerEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
            >
              <ListItemIcon className={classes.itemIcon}>
                <Icon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={t(item.titleKey)} className={classes.label} />}
            </ListItemButton>
          );
          return (
            <li key={item.key} className={classes.listItem}>
              {collapsed ? (
                <Tooltip title={t(item.titleKey)} placement={tooltipPlacement}>
                  {button}
                </Tooltip>
              ) : (
                button
              )}
            </li>
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
