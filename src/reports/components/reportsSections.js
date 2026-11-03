import { useMemo } from 'react';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import EventRepeatRoundedIcon from '@mui/icons-material/EventRepeatRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import { useAdministrator, useRestriction } from '../../common/util/permissions';

const singleDevicePaths = ['/reports/chart', '/reports/route', '/replay'];

// Carries the selected devices/groups from the current report into the target one.
export const buildReportLink = (path, search) => {
  const sourceParams = new URLSearchParams(search);
  const deviceIds = sourceParams.getAll('deviceId');
  const groupIds = sourceParams.getAll('groupId');
  if (!deviceIds.length && !groupIds.length) {
    return path;
  }
  const params = new URLSearchParams();
  if (singleDevicePaths.includes(path)) {
    const [firstDeviceId] = deviceIds;
    if (firstDeviceId != null) {
      params.append('deviceId', firstDeviceId);
    }
  } else {
    deviceIds.forEach((deviceId) => params.append('deviceId', deviceId));
    groupIds.forEach((groupId) => params.append('groupId', groupId));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

const exact = (path) => (pathname) => pathname === path;

export const useReportsSections = () => {
  const admin = useAdministrator();
  const readonly = useRestriction('readonly');

  return useMemo(
    () =>
      [
        {
          id: 'reports',
          titleKey: 'reportTitle',
          items: [
            {
              id: 'combined',
              titleKey: 'reportCombined',
              icon: StarRoundedIcon,
              path: '/reports/combined',
              match: exact('/reports/combined'),
              carry: true,
            },
            {
              id: 'events',
              titleKey: 'reportEvents',
              icon: NotificationsActiveRoundedIcon,
              path: '/reports/events',
              match: exact('/reports/events'),
              carry: true,
            },
            {
              id: 'geofences',
              titleKey: 'sharedGeofences',
              icon: PlaceRoundedIcon,
              path: '/reports/geofences',
              match: exact('/reports/geofences'),
              carry: true,
            },
            {
              id: 'trips',
              titleKey: 'reportTrips',
              icon: PlayCircleRoundedIcon,
              path: '/reports/trips',
              match: exact('/reports/trips'),
              carry: true,
            },
            {
              id: 'stops',
              titleKey: 'reportStops',
              icon: PauseCircleRoundedIcon,
              path: '/reports/stops',
              match: exact('/reports/stops'),
              carry: true,
            },
            {
              id: 'summary',
              titleKey: 'reportSummary',
              icon: ListAltRoundedIcon,
              path: '/reports/summary',
              match: exact('/reports/summary'),
              carry: true,
            },
            {
              id: 'chart',
              titleKey: 'reportChart',
              icon: ShowChartRoundedIcon,
              path: '/reports/chart',
              match: exact('/reports/chart'),
              carry: true,
            },
            {
              id: 'replay',
              titleKey: 'reportReplay',
              icon: RouteRoundedIcon,
              path: '/replay',
              match: exact('/replay'),
              carry: true,
            },
            {
              id: 'positions',
              titleKey: 'reportPositions',
              icon: TimelineRoundedIcon,
              path: '/reports/route',
              match: exact('/reports/route'),
              carry: true,
            },
          ],
        },
        {
          id: 'tools',
          titleKey: 'reportsGroupTools',
          items: [
            {
              id: 'logs',
              titleKey: 'sharedLogs',
              icon: ArticleRoundedIcon,
              path: '/reports/logs',
              match: exact('/reports/logs'),
            },
            {
              id: 'scheduled',
              titleKey: 'reportScheduled',
              icon: EventRepeatRoundedIcon,
              path: '/reports/scheduled',
              match: exact('/reports/scheduled'),
              visible: !readonly,
            },
            {
              id: 'statistics',
              titleKey: 'statisticsTitle',
              icon: BarChartRoundedIcon,
              path: '/reports/statistics',
              match: (pathname) =>
                ['/reports/statistics', '/reports/device-statistics'].includes(pathname),
              visible: admin,
            },
            {
              id: 'audit',
              titleKey: 'reportAudit',
              icon: VerifiedUserRoundedIcon,
              path: '/reports/audit',
              match: exact('/reports/audit'),
              visible: admin,
            },
          ],
        },
      ]
        .map((group) => ({ ...group, items: group.items.filter((item) => item.visible !== false) }))
        .filter((group) => group.items.length > 0),
    [admin, readonly],
  );
};

export const useReportsSectionItems = () => {
  const sections = useReportsSections();
  return useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({ ...item, groupKey: section.titleKey })),
      ),
    [sections],
  );
};
