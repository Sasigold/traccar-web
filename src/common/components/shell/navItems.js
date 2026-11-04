import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAdministrator, useRestriction } from '../../util/permissions';

// Primary destinations shown in the navigation rail and the mobile tabs.
export default () => {
  const readonly = useRestriction('readonly');
  const disableReports = useRestriction('disableReports');
  const admin = useAdministrator();
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
      },
      {
        key: 'settings',
        titleKey: 'settingsTitle',
        icon: SettingsRoundedIcon,
        path: '/settings',
        match: (pathname) =>
          pathname.startsWith('/settings') && !pathname.startsWith('/settings/geofence'),
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
  }, [readonly, disableReports, admin, selectedDeviceId, devices]);
};
