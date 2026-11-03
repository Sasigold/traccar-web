import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { useRestriction } from '../../util/permissions';

// Navigation sections, in display order. Items carry `section`; `footer` items sit at the bottom.
export const navSections = [
  { id: 'operations', titleKey: 'shellSectionOperations' },
  { id: 'insights', titleKey: 'shellSectionInsights' },
  { id: 'fleet', titleKey: 'shellSectionFleet' },
];

// Primary destinations shown in the navigation rail, mobile drawer, tabs and command palette.
export default () => {
  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const devices = useSelector((state) => state.devices.items);

  return useMemo(() => {
    const deviceIds = Object.keys(devices);
    const id = selectedDeviceId ?? (deviceIds.length === 1 ? deviceIds[0] : null);
    const deviceQuery = id != null ? `?deviceId=${id}` : '';
    return [
      {
        key: 'dashboard',
        section: 'operations',
        titleKey: 'shellDashboard',
        icon: SpaceDashboardRoundedIcon,
        path: '/dashboard',
        match: (pathname) => pathname.startsWith('/dashboard'),
        tab: true,
      },
      {
        key: 'map',
        section: 'operations',
        titleKey: 'shellLiveMap',
        icon: MapRoundedIcon,
        path: '/',
        match: (pathname) => pathname === '/',
        tab: true,
      },
      {
        key: 'replay',
        section: 'operations',
        titleKey: 'reportReplay',
        icon: RouteRoundedIcon,
        path: `/replay${deviceQuery}`,
        match: (pathname) => pathname.startsWith('/replay'),
        hidden: disableReports,
      },
      {
        key: 'geofences',
        section: 'operations',
        titleKey: 'sharedGeofences',
        icon: HexagonRoundedIcon,
        path: '/geofences',
        match: (pathname) =>
          pathname.startsWith('/geofences') || pathname.startsWith('/settings/geofence'),
        hidden: readonly,
      },
      {
        key: 'reports',
        section: 'insights',
        titleKey: 'reportTitle',
        icon: InsightsRoundedIcon,
        path: `/reports/combined${deviceQuery}`,
        match: (pathname) => pathname.startsWith('/reports'),
        hidden: disableReports,
        tab: true,
      },
      {
        key: 'devices',
        section: 'fleet',
        titleKey: 'shellVehicles',
        icon: LocalShippingRoundedIcon,
        path: '/settings/devices',
        match: (pathname) => pathname.startsWith('/settings/device'),
        hidden: readonly,
      },
      {
        key: 'drivers',
        section: 'fleet',
        titleKey: 'sharedDrivers',
        icon: BadgeRoundedIcon,
        path: '/settings/drivers',
        match: (pathname) => pathname.startsWith('/settings/driver'),
        hidden: readonly,
      },
      {
        key: 'alerts',
        section: 'fleet',
        titleKey: 'shellAlertRules',
        icon: NotificationsActiveRoundedIcon,
        path: '/settings/notifications',
        match: (pathname) => pathname.startsWith('/settings/notification'),
        hidden: readonly,
      },
      {
        key: 'settings',
        section: 'footer',
        titleKey: 'settingsTitle',
        icon: SettingsRoundedIcon,
        path: '/settings',
        match: (pathname) => pathname.startsWith('/settings'),
        tab: true,
      },
    ].filter((item) => !item.hidden);
  }, [readonly, disableReports, selectedDeviceId, devices]);
};

// The first matching item wins, so specific destinations take precedence over the settings hub.
export const activeNavKey = (items, pathname) =>
  items.find((item) => item.match(pathname))?.key ?? null;
