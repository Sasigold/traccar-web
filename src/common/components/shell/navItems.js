import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAdministrator, useRestriction } from '../../util/permissions';

// Settings pages that belong to the "Fleet" destination (vehicles, drivers, maintenance, documents).
const fleetSettingsPaths = [
  '/settings/device',
  '/settings/driver',
  '/settings/maintenance',
  '/settings/fleet-documents',
  '/settings/accumulators',
];

const isFleetPath = (pathname) =>
  pathname.startsWith('/fleet') || fleetSettingsPaths.some((path) => pathname.startsWith(path));

// Primary destinations shown in the navigation rail and the mobile tabs.
export default () => {
  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const admin = useAdministrator();
  // Fleet role "driver" gets the driver portal (roadmap 4.6) instead of the fleet screens.
  const driverRole = useSelector((state) => state.fleet.profile?.role === 'driver');
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const devices = useSelector((state) => state.devices.items);

  return useMemo(() => {
    const deviceIds = Object.keys(devices);
    let reportsPath = '/reports/combined';
    const id = selectedDeviceId ?? (deviceIds.length === 1 ? deviceIds[0] : null);
    if (id != null) {
      reportsPath = `/reports/combined?deviceId=${id}`;
    }
    return [
      {
        key: 'map',
        titleKey: 'mapTitle',
        icon: MapRoundedIcon,
        path: '/',
        match: (pathname) => pathname === '/',
      },
      {
        key: 'dashboard',
        titleKey: 'dashboardTitle',
        icon: SpaceDashboardRoundedIcon,
        path: '/dashboard',
        match: (pathname) => pathname.startsWith('/dashboard'),
        hidden: driverRole,
        // The phone tab bar is full; on phones the dashboard opens from the menu.
        mobileHidden: true,
      },
      {
        key: 'reports',
        titleKey: 'reportTitle',
        icon: InsightsRoundedIcon,
        path: reportsPath,
        match: (pathname) => pathname.startsWith('/reports') || pathname.startsWith('/replay'),
        hidden: disableReports,
      },
      {
        key: 'geofences',
        titleKey: 'sharedGeofences',
        icon: HexagonRoundedIcon,
        path: '/geofences',
        match: (pathname) =>
          pathname.startsWith('/geofences') || pathname.startsWith('/settings/geofence'),
        hidden: readonly,
        mobileHidden: true,
      },
      {
        key: 'fleet',
        titleKey: 'fleetTitle',
        icon: LocalShippingRoundedIcon,
        path: '/fleet',
        match: isFleetPath,
        hidden: readonly || driverRole,
      },
      {
        key: 'driver',
        titleKey: 'fleetDriverPortal',
        icon: BadgeRoundedIcon,
        path: '/driver',
        match: (pathname) => pathname.startsWith('/driver'),
        hidden: !driverRole,
      },
      {
        key: 'settings',
        titleKey: 'settingsTitle',
        icon: SettingsRoundedIcon,
        path: '/settings',
        match: (pathname) =>
          pathname.startsWith('/settings') &&
          !pathname.startsWith('/settings/geofence') &&
          !isFleetPath(pathname),
      },
      {
        key: 'admin',
        titleKey: 'adminTitle',
        icon: AdminPanelSettingsRoundedIcon,
        path: '/admin',
        match: (pathname) => pathname.startsWith('/admin'),
        hidden: !admin,
      },
    ].filter((item) => !item.hidden);
  }, [readonly, disableReports, admin, driverRole, selectedDeviceId, devices]);
};
