import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import { useMemo } from 'react';
import ViewTimelineRoundedIcon from '@mui/icons-material/ViewTimelineRounded';
import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import Co2RoundedIcon from '@mui/icons-material/Co2Rounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
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
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import { useAdministrator, useRestriction } from '../../common/util/permissions';
import { useFleetPermission } from '../../common/fleet/useFleet';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import TollRoundedIcon from '@mui/icons-material/TollRounded';

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

// Reports by the question they answer (REP-02), with the fleet database's own reports (safety,
// costs, visits, validity) next to Traccar's.
export const useReportsSections = () => {
  const admin = useAdministrator();
  const readonly = useRestriction('readonly');
  const fleetSafety = useFleetPermission('safety.read');
  const fleetCosts = useFleetPermission('costs.read');
  const fleetPoi = useFleetPermission('poi.read');

  return useMemo(
    () =>
      [
        {
          id: 'activity',
          titleKey: 'reportsGroupActivity',
          items: [
            {
              id: 'timeline',
              descriptionKey: 'reportTimelineDescription',
              titleKey: 'reportTimeline',
              icon: ViewTimelineRoundedIcon,
              path: '/reports/timeline',
              match: exact('/reports/timeline'),
              carry: true,
            },
            {
              id: 'usage',
              descriptionKey: 'reportUsageDescription',
              titleKey: 'reportUsage',
              icon: DonutLargeRoundedIcon,
              path: '/reports/usage',
              match: exact('/reports/usage'),
              carry: true,
            },
            {
              id: 'workHours',
              descriptionKey: 'reportWorkHoursDescription',
              titleKey: 'reportWorkHours',
              icon: BadgeRoundedIcon,
              path: '/reports/work-hours',
              match: exact('/reports/work-hours'),
              carry: true,
            },
            {
              id: 'tolls',
              descriptionKey: 'reportTollsDescription',
              titleKey: 'reportTolls',
              icon: TollRoundedIcon,
              path: '/reports/tolls',
              match: exact('/reports/tolls'),
            },
            {
              id: 'summary',
              descriptionKey: 'reportSummaryDescription',
              titleKey: 'reportSummary',
              icon: ListAltRoundedIcon,
              path: '/reports/summary',
              match: exact('/reports/summary'),
              carry: true,
            },
            {
              id: 'trips',
              descriptionKey: 'reportTripsDescription',
              titleKey: 'reportTrips',
              icon: PlayCircleRoundedIcon,
              path: '/reports/trips',
              match: exact('/reports/trips'),
              carry: true,
            },
            {
              id: 'stops',
              descriptionKey: 'reportStopsDescription',
              titleKey: 'reportStops',
              icon: PauseCircleRoundedIcon,
              path: '/reports/stops',
              match: exact('/reports/stops'),
              carry: true,
            },
            {
              id: 'combined',
              descriptionKey: 'reportCombinedDescription',
              titleKey: 'reportCombined',
              icon: StarRoundedIcon,
              path: '/reports/combined',
              match: exact('/reports/combined'),
              carry: true,
            },
            {
              id: 'heatmap',
              descriptionKey: 'reportHeatmapDescription',
              titleKey: 'reportHeatmap',
              icon: BlurOnRoundedIcon,
              path: '/reports/heatmap',
              match: exact('/reports/heatmap'),
              carry: true,
            },
            {
              id: 'chart',
              descriptionKey: 'reportChartDescription',
              titleKey: 'reportChart',
              icon: ShowChartRoundedIcon,
              path: '/reports/chart',
              match: exact('/reports/chart'),
              carry: true,
            },
          ],
        },
        {
          id: 'behavior',
          titleKey: 'reportsGroupBehavior',
          items: [
            {
              id: 'events',
              descriptionKey: 'reportEventsDescription',
              titleKey: 'reportEvents',
              icon: NotificationsActiveRoundedIcon,
              path: '/reports/events',
              match: exact('/reports/events'),
              carry: true,
            },
            {
              id: 'safety',
              descriptionKey: 'fleetSafetyPageDescription',
              titleKey: 'fleetSafetyPage',
              icon: HealthAndSafetyRoundedIcon,
              path: '/fleet/safety',
              match: (pathname) => pathname === '/fleet/safety',
              visible: fleetSafety,
            },
          ],
        },
        {
          id: 'places',
          titleKey: 'reportsGroupPlaces',
          items: [
            {
              id: 'geofences',
              descriptionKey: 'reportGeofencesDescription',
              titleKey: 'sharedGeofences',
              icon: PlaceRoundedIcon,
              path: '/reports/geofences',
              match: exact('/reports/geofences'),
              carry: true,
            },
            {
              id: 'replay',
              descriptionKey: 'reportReplayDescription',
              titleKey: 'reportReplay',
              icon: RouteRoundedIcon,
              path: '/replay',
              match: exact('/replay'),
              carry: true,
            },
            {
              id: 'positions',
              descriptionKey: 'reportPositionsDescription',
              titleKey: 'reportPositions',
              icon: TimelineRoundedIcon,
              path: '/reports/route',
              match: exact('/reports/route'),
              carry: true,
            },
            {
              id: 'visits',
              descriptionKey: 'fleetPoiPageDescription',
              titleKey: 'fleetPoiPage',
              icon: StorefrontRoundedIcon,
              path: '/fleet/poi',
              match: (pathname) => pathname.startsWith('/fleet/poi'),
              visible: fleetPoi,
            },
          ],
        },
        {
          id: 'costs',
          titleKey: 'reportsGroupCosts',
          items: [
            {
              id: 'costPerKm',
              descriptionKey: 'reportCostPerKmDescription',
              titleKey: 'reportCostPerKm',
              icon: PaidRoundedIcon,
              path: '/reports/cost-per-km',
              match: exact('/reports/cost-per-km'),
              carry: true,
              visible: fleetCosts,
            },
            {
              // OPS-10: works from kilometers alone; fuel imports make it exact.
              id: 'emissions',
              descriptionKey: 'reportEmissionsDescription',
              titleKey: 'reportEmissions',
              icon: Co2RoundedIcon,
              path: '/reports/emissions',
              match: exact('/reports/emissions'),
              carry: true,
              visible: true,
            },
            {
              id: 'costs',
              descriptionKey: 'fleetCostsPageDescription',
              titleKey: 'fleetCostsPage',
              icon: LocalGasStationRoundedIcon,
              path: '/fleet/costs',
              match: (pathname) => pathname.startsWith('/fleet/costs'),
              visible: fleetCosts,
            },
            {
              id: 'expiries',
              descriptionKey: 'fleetExpiriesPageDescription',
              titleKey: 'fleetExpiriesPage',
              icon: EventAvailableRoundedIcon,
              path: '/fleet/expiries',
              match: (pathname) => pathname.startsWith('/fleet/expiries'),
              visible: true,
            },
            {
              id: 'maintenance',
              descriptionKey: 'settingsMaintenanceDescription',
              titleKey: 'sharedMaintenance',
              icon: BuildRoundedIcon,
              path: '/settings/maintenances',
              match: (pathname) => pathname.startsWith('/settings/maintenances'),
              visible: !readonly,
            },
          ],
        },
        {
          id: 'tools',
          titleKey: 'reportsGroupTools',
          items: [
            {
              id: 'deviceHealth',
              descriptionKey: 'reportDeviceHealthDescription',
              titleKey: 'reportDeviceHealth',
              icon: MonitorHeartRoundedIcon,
              path: '/reports/device-health',
              match: exact('/reports/device-health'),
              carry: true,
            },
            {
              id: 'scheduled',
              descriptionKey: 'reportScheduledDescription',
              titleKey: 'reportScheduled',
              icon: EventRepeatRoundedIcon,
              path: '/reports/scheduled',
              match: exact('/reports/scheduled'),
              visible: !readonly,
            },
            {
              id: 'logs',
              descriptionKey: 'reportLogsDescription',
              titleKey: 'sharedLogs',
              icon: ArticleRoundedIcon,
              path: '/reports/logs',
              match: exact('/reports/logs'),
            },
            {
              id: 'statistics',
              descriptionKey: 'reportStatisticsDescription',
              titleKey: 'statisticsTitle',
              icon: BarChartRoundedIcon,
              path: '/reports/statistics',
              match: (pathname) =>
                ['/reports/statistics', '/reports/device-statistics'].includes(pathname),
              visible: admin,
            },
            {
              id: 'audit',
              descriptionKey: 'reportAuditDescription',
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
    [admin, readonly, fleetSafety, fleetCosts, fleetPoi],
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
