import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dialog,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { devicesActions } from '../../../store';
import { useTranslation } from '../LocalizationProvider';
import { useDeviceReadonly, useRestriction } from '../../util/permissions';
import useFeatures from '../../util/useFeatures';
import useLogout from '../../util/useLogout';
import useThemeMode from '../../theme/useThemeMode';
import { useSettingsSectionItems } from '../../../settings/components/settingsSections';
import {
  buildReportLink,
  useReportsSectionItems,
} from '../../../reports/components/reportsSections';
import { glass } from '../../theme/surfaces';
import DeviceTile from '../brand/DeviceTile';
import useNavItems from './navItems';
import { useShell } from './ShellContext';

const useStyles = makeStyles()((theme) => ({
  paper: {
    ...glass(theme, 0.94),
    width: theme.dimensions.commandPaletteWidth,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: theme.tokens.radius.xxl,
    overflow: 'hidden',
    margin: 0,
    marginTop: '10vh',
    [theme.breakpoints.down('sm')]: {
      marginTop: theme.spacing(2),
    },
  },
  container: {
    alignItems: 'flex-start',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2.5),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
    color: theme.palette.text.secondary,
  },
  input: {
    flex: 1,
    fontSize: '1.0625rem',
    color: theme.palette.text.primary,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    padding: '0 7px',
    borderRadius: 6,
    fontSize: '0.6875rem',
    fontWeight: 700,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    border: `1px solid ${theme.palette.surface.borderStrong}`,
    backgroundColor: theme.palette.background.paper,
  },
  list: {
    maxHeight: '56vh',
    overflowY: 'auto',
    padding: theme.spacing(1),
  },
  subheader: {
    lineHeight: '28px',
    paddingInline: theme.spacing(1.5),
    backgroundColor: 'transparent',
  },
  item: {
    borderRadius: theme.tokens.radius.md,
    marginInline: 0,
    gap: theme.spacing(1),
    '&.Mui-selected': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
    },
    '&.Mui-selected::before': {
      display: 'none',
    },
  },
  empty: {
    padding: theme.spacing(5, 2),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2.5),
    borderTop: `1px solid ${theme.palette.surface.border}`,
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
}));

const normalize = (value) => (value || '').toString().toLowerCase();

const CommandPalette = ({ open, onClose }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { openEvents } = useShell();

  const devices = useSelector((state) => state.devices.items);
  const features = useFeatures();
  const deviceReadonly = useDeviceReadonly();
  const readonly = useRestriction('readonly');
  const logout = useLogout();
  const { dark, forced, toggle } = useThemeMode();

  const navItems = useNavItems();
  const settingsItems = useSettingsSectionItems();
  const reportItems = useReportsSectionItems();

  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlighted(0);
    }
  }, [open]);

  const groups = useMemo(() => {
    const needle = normalize(query).trim();
    const matches = (...values) => !needle || values.some((v) => normalize(v).includes(needle));

    const deviceEntries = Object.values(devices)
      .filter((device) => matches(device.name, device.uniqueId, device.phone, device.model))
      .slice(0, needle ? 8 : 5)
      .map((device) => ({
        id: `device-${device.id}`,
        title: device.name,
        subtitle: device.uniqueId,
        device,
        onSelect: () => {
          dispatch(devicesActions.selectId(device.id));
          navigate('/');
        },
      }));

    const navigationEntries = [
      ...navItems.map((item) => ({
        id: `nav-${item.key}`,
        title: t(item.titleKey),
        icon: item.icon,
        onSelect: () => navigate(item.path),
      })),
      ...settingsItems.map((item) => ({
        id: `settings-${item.id}`,
        title: t(item.titleKey),
        subtitle: `${t('settingsTitle')} · ${t(item.groupKey)}`,
        icon: item.icon,
        onSelect: () => {
          if (item.href) {
            window.open(item.href, '_blank', 'noopener');
          } else {
            navigate(item.path);
          }
        },
      })),
      ...reportItems.map((item) => ({
        id: `report-${item.id}`,
        title: t(item.titleKey),
        subtitle: t('reportTitle'),
        icon: item.icon,
        onSelect: () =>
          navigate(item.carry ? buildReportLink(item.path, location.search) : item.path),
      })),
      ...(!readonly
        ? [
            {
              id: 'nav-emulator',
              title: t('sharedEmulator'),
              icon: SmartToyRoundedIcon,
              onSelect: () => navigate('/emulator'),
            },
          ]
        : []),
    ].filter((entry) => matches(entry.title, entry.subtitle));

    const actionEntries = [
      ...(!forced
        ? [
            {
              id: 'action-theme',
              title: dark ? t('shellSwitchLight') : t('shellSwitchDark'),
              icon: dark ? LightModeRoundedIcon : DarkModeRoundedIcon,
              onSelect: toggle,
            },
          ]
        : []),
      ...(!features.disableEvents
        ? [
            {
              id: 'action-events',
              title: t('reportEvents'),
              icon: NotificationsRoundedIcon,
              onSelect: openEvents,
            },
          ]
        : []),
      ...(!deviceReadonly
        ? [
            {
              id: 'action-add-device',
              title: t('shellAddDevice'),
              icon: AddRoundedIcon,
              onSelect: () => navigate('/settings/device'),
            },
          ]
        : []),
      {
        id: 'action-logout',
        title: t('loginLogout'),
        icon: LogoutRoundedIcon,
        onSelect: logout,
      },
    ].filter((entry) => matches(entry.title));

    return [
      { key: 'devices', title: t('deviceTitle'), entries: deviceEntries },
      { key: 'navigation', title: t('shellNavigation'), entries: navigationEntries },
      { key: 'actions', title: t('shellActions'), entries: actionEntries },
    ].filter((group) => group.entries.length > 0);
  }, [
    query,
    devices,
    navItems,
    settingsItems,
    reportItems,
    readonly,
    forced,
    dark,
    features.disableEvents,
    deviceReadonly,
    t,
    dispatch,
    navigate,
    location.search,
    toggle,
    openEvents,
    logout,
  ]);

  const flat = useMemo(() => groups.flatMap((group) => group.entries), [groups]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    const element = listRef.current?.querySelector('[data-highlighted="true"]');
    element?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, groups]);

  const select = (entry) => {
    onClose();
    entry.onSelect();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => (flat.length ? (index + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => (flat.length ? (index - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (flat[highlighted]) {
        select(flat[highlighted]);
      }
    }
  };

  let runningIndex = -1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      classes={{ container: classes.container }}
      slotProps={{ paper: { className: classes.paper } }}
    >
      <div className={classes.inputRow}>
        <SearchRoundedIcon />
        <InputBase
          className={classes.input}
          placeholder={t('shellCommandPalette')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          inputProps={{ 'aria-label': t('shellCommandPalette') }}
        />
        <span className={classes.kbd}>Esc</span>
      </div>
      <List ref={listRef} className={classes.list} disablePadding>
        {groups.map((group) => (
          <li key={group.key}>
            <ul style={{ padding: 0 }}>
              <ListSubheader className={classes.subheader} disableSticky>
                {group.title}
              </ListSubheader>
              {group.entries.map((entry) => {
                runningIndex += 1;
                const index = runningIndex;
                const Icon = entry.icon;
                const device = entry.device;
                return (
                  <ListItemButton
                    key={entry.id}
                    className={classes.item}
                    selected={index === highlighted}
                    data-highlighted={index === highlighted ? 'true' : undefined}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => select(entry)}
                  >
                    <ListItemIcon>
                      {device ? (
                        <DeviceTile category={device.category} status={device.status} size={32} />
                      ) : (
                        Icon && <Icon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={entry.title}
                      secondary={entry.subtitle}
                      slotProps={{
                        primary: { noWrap: true, fontWeight: 600 },
                        secondary: { noWrap: true },
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </ul>
          </li>
        ))}
        {flat.length === 0 && (
          <Typography className={cx(classes.empty)} variant="body2">
            {t('shellNoResults')}
          </Typography>
        )}
      </List>
      <div className={classes.footer}>
        <span className={classes.kbd}>↑↓</span>
        <span className={classes.kbd}>Enter</span>
        <span>{t('shellKeyboardHint')}</span>
      </div>
    </Dialog>
  );
};

export default CommandPalette;
