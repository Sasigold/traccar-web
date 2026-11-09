import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAdministrator, useDeviceReadonly, useRestriction } from '../../util/permissions';
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
import { adminSections } from '../../../admin/components/adminSections';
import { useShell } from './ShellContext';
import Highlight from '../Highlight';
import {
  deviceSearchFields,
  matchDevice,
  normalizeSearch,
  tokenizeSearch,
} from '../../util/deviceSearch';
import { recentDeviceIds } from '../../util/recentDevices';
import { activityOf } from '../../util/activity';

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
      marginTop: `calc(${theme.spacing(2)} + env(safe-area-inset-top, 0px))`,
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
  entry: {
    listStyle: 'none',
  },
  empty: {
    listStyle: 'none',
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

const normalize = (value) => normalizeSearch(value);

const CommandPalette = ({ open, onClose }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { openEvents } = useShell();

  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const deviceGroups = useSelector((state) => state.groups.items);
  const drivers = useSelector((state) => state.drivers.items);
  const features = useFeatures();
  const deviceReadonly = useDeviceReadonly();
  const readonly = useRestriction('readonly');
  const logout = useLogout();
  const { dark, forced, toggle } = useThemeMode();

  const navItems = useNavItems();
  const settingsItems = useSettingsSectionItems();
  const reportItems = useReportsSectionItems();
  const admin = useAdministrator();

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
    if (!open) {
      return [];
    }
    const needle = normalize(query).trim();
    const matches = (...values) => !needle || values.some((v) => normalize(v).includes(needle));
    const tokens = tokenizeSearch(query);

    // Plate and driver (or whatever else matched) under the name, with the match marked.
    const deviceEntry = (device, match) => {
      const position = positions[device.id];
      const driverName = drivers[position?.attributes?.driverUniqueId]?.name;
      const plate = device.attributes?.plateNumber;
      const extra = match?.fields.find((field) => field.key !== 'name' && field.key !== 'plate');
      const details = [
        plate && { value: plate, digits: true },
        extra
          ? { value: extra.value, digits: ['uniqueId', 'phone'].includes(extra.key) }
          : driverName && { value: driverName },
      ].filter(Boolean);
      if (!details.length) {
        details.push({ value: device.uniqueId, digits: true });
      }
      return {
        id: `device-${device.id}`,
        title: device.name,
        titleNode: <Highlight text={device.name} tokens={tokens} />,
        subtitle: details.map((detail) => detail.value).join(' · '),
        subtitleNode: details.map((detail, index) => (
          <Fragment key={detail.value}>
            {index > 0 && ' · '}
            <bdi dir={detail.digits ? 'ltr' : 'auto'}>
              <Highlight text={detail.value} tokens={tokens} digits={detail.digits} />
            </bdi>
          </Fragment>
        )),
        device,
        onSelect: () => {
          dispatch(devicesActions.selectId(device.id));
          navigate('/');
        },
      };
    };

    const deviceSections = [];
    if (tokens.length) {
      const found = Object.values(devices)
        .map((device) => ({
          device,
          match: matchDevice(
            tokens,
            deviceSearchFields(device, {
              groups: deviceGroups,
              drivers,
              position: positions[device.id],
            }),
          ),
        }))
        .filter((item) => item.match)
        .sort((a, b) => b.match.score - a.match.score || a.device.name.localeCompare(b.device.name))
        .slice(0, 8);
      deviceSections.push({
        key: 'devices',
        title: t('deviceTitle'),
        entries: found.map((item) => deviceEntry(item.device, item.match)),
      });
    } else {
      const recent = recentDeviceIds()
        .map((id) => devices[id])
        .filter(Boolean);
      const now = Date.now();
      const recentIds = new Set(recent.map((device) => device.id));
      const attention = Object.values(devices)
        .filter(
          (device) =>
            !recentIds.has(device.id) &&
            (positions[device.id]?.attributes?.alarm ||
              activityOf(device, positions[device.id], now) === 'stale'),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 5);
      deviceSections.push(
        {
          key: 'recent',
          title: t('shellRecentDevices'),
          entries: recent.map((device) => deviceEntry(device)),
        },
        {
          key: 'attention',
          title: t('shellAttentionDevices'),
          entries: attention.map((device) => deviceEntry(device)),
        },
      );
      if (!recent.length && !attention.length) {
        deviceSections.push({
          key: 'devices',
          title: t('deviceTitle'),
          entries: Object.values(devices)
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 5)
            .map((device) => deviceEntry(device)),
        });
      }
    }

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
      ...(admin
        ? adminSections.flatMap((section) =>
            section.items
              .filter((item) => item.id !== 'overview')
              .map((item) => ({
                id: `admin-${item.id}`,
                title: t(item.titleKey),
                subtitle: `${t('adminTitle')} · ${t(section.titleKey)}`,
                icon: item.icon,
                onSelect: () => navigate(item.path),
              })),
          )
        : []),
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
              title: t('sharedNotifications'),
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
      ...deviceSections,
      { key: 'navigation', title: t('shellNavigation'), entries: navigationEntries },
      { key: 'actions', title: t('shellActions'), entries: actionEntries },
    ].filter((group) => group.entries.length > 0);
  }, [
    open,
    query,
    devices,
    positions,
    deviceGroups,
    drivers,
    navItems,
    settingsItems,
    reportItems,
    admin,
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
                  <li key={entry.id} className={classes.entry}>
                    <ListItemButton
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
                        primary={entry.titleNode || entry.title}
                        secondary={entry.subtitleNode || entry.subtitle}
                        slotProps={{
                          primary: { noWrap: true, fontWeight: 600 },
                          secondary: { noWrap: true },
                        }}
                      />
                    </ListItemButton>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
        {flat.length === 0 && (
          <Typography component="li" className={cx(classes.empty)} variant="body2">
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
