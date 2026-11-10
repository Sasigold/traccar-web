import AccessibilityNewRoundedIcon from '@mui/icons-material/AccessibilityNewRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PrivacyTipRoundedIcon from '@mui/icons-material/PrivacyTipRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import HexagonRoundedIcon from '@mui/icons-material/HexagonRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import RouterRoundedIcon from '@mui/icons-material/RouterRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import RvHookupRoundedIcon from '@mui/icons-material/RvHookupRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import WebhookRoundedIcon from '@mui/icons-material/WebhookRounded';
import { useAdministrator, useManager, useRestriction } from '../../common/util/permissions';
import useFeatures from '../../common/util/useFeatures';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { hasFleetFeature, useFleetFeatures } from '../../common/fleet/features';

// Single source of truth for the menus: the settings area and the fleet area drive their side
// menus, hub cards and the command palette.
const useSectionCatalog = () => {
  const readonly = useRestriction('readonly');
  const admin = useAdministrator();
  const manager = useManager();
  const features = useFeatures();
  const userId = useSelector((state) => state.session.user.id);
  const supportLink = useSelector((state) => state.session.server.attributes.support);
  const billingLink = useSelector((state) => state.session.user.attributes.billingLink);
  const fleetDocuments = useFleetPermission('documents.read');
  const fleetAlerts = useFleetPermission('alerts.read');
  const fleetMaintenance = useFleetPermission('maintenance.read');
  const fleetIncidents = useFleetPermission('incidents.read');
  const fleetCosts = useFleetPermission('costs.read');
  const fleetInspections = useFleetPermission('inspections.read');
  const fleetUsers = useFleetPermission('users.read');
  const fleetSafety = useFleetPermission('safety.read');
  const fleetPoi = useFleetPermission('poi.read');
  const fleetDispatch = useFleetPermission('dispatch.read');
  const fleetVehicles = useFleetPermission('vehicles.read');
  const fleetDrivers = useFleetPermission('drivers.read');
  const fleetIntegrations = useFleetPermission('integrations.manage');
  const fleetPrivacy = useFleetPermission('privacy.manage');
  const fleetUsersManage = useFleetPermission('users.manage');
  // ADM-08: areas whose tables this fleet database does not have are not offered.
  const fleetFeatures = useFleetFeatures();

  return useMemo(() => {
    const has = (feature) => hasFleetFeature(fleetFeatures, feature);
    const profilePath = `/settings/user/${userId}`;
    const tidy = (groups) =>
      groups
        .filter((group) => group.visible !== false)
        .map((group) => ({ ...group, items: group.items.filter((item) => item.visible !== false) }))
        .filter((group) => group.items.length > 0);
    const settings = [
      {
        id: 'account',
        titleKey: 'settingsUser',
        items: [
          {
            id: 'profile',
            titleKey: 'settingsProfile',
            descriptionKey: 'settingsProfileDescription',
            icon: PersonRoundedIcon,
            path: profilePath,
            match: (pathname) => pathname === profilePath,
            visible: !readonly,
          },
          {
            id: 'preferences',
            titleKey: 'sharedPreferences',
            descriptionKey: 'settingsPreferencesDescription',
            icon: TuneRoundedIcon,
            path: '/settings/preferences',
            match: (pathname) => pathname.startsWith('/settings/preferences'),
          },
          {
            id: 'notifications',
            titleKey: 'notificationRules',
            descriptionKey: 'settingsNotificationsDescription',
            icon: NotificationsRoundedIcon,
            path: '/settings/notifications',
            match: (pathname) => pathname.startsWith('/settings/notification'),
            visible: !readonly,
          },
        ],
      },
      {
        id: 'fleetConfig',
        titleKey: 'settingsGroupFleetConfig',
        visible: !readonly,
        items: [
          {
            id: 'groups',
            titleKey: 'settingsGroups',
            descriptionKey: 'settingsGroupsDescription',
            icon: FolderRoundedIcon,
            path: '/settings/groups',
            match: (pathname) => pathname.startsWith('/settings/group'),
            visible: !features.disableGroups,
          },
          {
            id: 'geofences',
            titleKey: 'sharedGeofences',
            descriptionKey: 'settingsGeofencesDescription',
            icon: HexagonRoundedIcon,
            path: '/geofences',
            match: (pathname) =>
              pathname === '/geofences' || pathname.startsWith('/settings/geofence'),
          },
          {
            id: 'calendars',
            titleKey: 'sharedCalendars',
            descriptionKey: 'settingsCalendarsDescription',
            icon: CalendarMonthRoundedIcon,
            path: '/settings/calendars',
            match: (pathname) => pathname.startsWith('/settings/calendar'),
            visible: !features.disableCalendars,
          },
        ],
      },
      {
        id: 'admin',
        titleKey: 'settingsGroupAdministration',
        items: [
          {
            id: 'users',
            titleKey: 'settingsUsers',
            descriptionKey: 'settingsUsersDescription',
            icon: PeopleRoundedIcon,
            path: '/settings/users',
            match: (pathname) => pathname.startsWith('/settings/user') && pathname !== profilePath,
            visible: Boolean(manager),
          },
          {
            id: 'fleetUsers',
            titleKey: 'fleetUsersPage',
            descriptionKey: 'fleetUsersPageDescription',
            icon: AdminPanelSettingsRoundedIcon,
            path: '/fleet/users',
            match: (pathname) =>
              pathname.startsWith('/fleet/users') || pathname.startsWith('/fleet/roles'),
            visible: fleetUsers,
          },
          {
            id: 'integrations',
            titleKey: 'fleetIntegrationsPage',
            descriptionKey: 'fleetIntegrationsPageDescription',
            icon: WebhookRoundedIcon,
            path: '/fleet/integrations',
            match: (pathname) => pathname.startsWith('/fleet/integrations'),
            visible: fleetIntegrations && has('integrations'),
          },
          {
            id: 'privacy',
            titleKey: 'privacyPage',
            descriptionKey: 'privacyPageDescription',
            icon: PrivacyTipRoundedIcon,
            path: '/fleet/privacy',
            match: (pathname) => pathname.startsWith('/fleet/privacy'),
            visible: fleetPrivacy && has('privacy'),
          },
          {
            id: 'ai',
            titleKey: 'aiSettingsPage',
            descriptionKey: 'aiSettingsDescription',
            icon: AutoAwesomeRoundedIcon,
            path: '/fleet/ai',
            match: (pathname) => pathname.startsWith('/fleet/ai'),
            // AI-01..04: only where the fleet database has it (unknown is no).
            visible: fleetUsersManage && Boolean(fleetFeatures?.includes('ai')),
          },
          {
            id: 'server',
            titleKey: 'settingsServer',
            descriptionKey: 'settingsServerDescription',
            icon: SettingsRoundedIcon,
            path: '/settings/server',
            match: (pathname) => pathname === '/settings/server',
            visible: Boolean(admin),
          },
          {
            id: 'announcement',
            titleKey: 'serverAnnouncement',
            descriptionKey: 'settingsAnnouncementDescription',
            icon: CampaignRoundedIcon,
            path: '/settings/announcement',
            match: (pathname) => pathname === '/settings/announcement',
            visible: Boolean(manager),
          },
          {
            id: 'protocols',
            titleKey: 'settingsProtocols',
            descriptionKey: 'settingsProtocolsDescription',
            icon: RouterRoundedIcon,
            path: '/settings/protocols',
            match: (pathname) => pathname === '/settings/protocols',
            visible: Boolean(admin),
          },
        ],
      },
      {
        id: 'advanced',
        titleKey: 'settingsGroupAdvanced',
        visible: !readonly,
        collapsible: true,
        items: [
          {
            id: 'commands',
            titleKey: 'sharedSavedCommands',
            descriptionKey: 'settingsCommandsDescription',
            icon: SendRoundedIcon,
            path: '/settings/commands',
            match: (pathname) => pathname.startsWith('/settings/command'),
            visible: !features.disableSavedCommands,
          },
          {
            id: 'attributes',
            titleKey: 'sharedComputedAttributes',
            descriptionKey: 'settingsAttributesDescription',
            icon: CalculateRoundedIcon,
            path: '/settings/attributes',
            match: (pathname) => pathname.startsWith('/settings/attribute'),
            visible: !features.disableComputedAttributes,
          },
        ],
      },
      {
        id: 'help',
        titleKey: 'settingsGroupHelp',
        items: [
          {
            // A11-07
            id: 'accessibility',
            titleKey: 'settingsAccessibility',
            descriptionKey: 'settingsAccessibilityDescription',
            icon: AccessibilityNewRoundedIcon,
            path: '/accessibility',
            match: (pathname) => pathname === '/accessibility',
          },
          {
            id: 'support',
            titleKey: 'settingsSupport',
            descriptionKey: 'settingsSupportDescription',
            icon: HelpRoundedIcon,
            href: supportLink,
            visible: Boolean(supportLink),
          },
          {
            id: 'billing',
            titleKey: 'userBilling',
            descriptionKey: 'settingsBillingDescription',
            icon: PaymentsRoundedIcon,
            href: billingLink,
            visible: Boolean(billingLink),
          },
        ],
      },
    ];
    // The fleet area, by the work people do (ADM-02): operations, vehicles and drivers, validity
    // and alerts, costs, safety. Settings keep only configuration.
    const fleet = [
      {
        id: 'fleetOperations',
        titleKey: 'fleetGroupOperations',
        items: [
          {
            id: 'dispatch',
            titleKey: 'fleetDispatchPage',
            descriptionKey: 'fleetDispatchPageDescription',
            icon: LocalShippingRoundedIcon,
            path: '/fleet/dispatch',
            match: (pathname) => pathname.startsWith('/fleet/dispatch'),
            visible: fleetDispatch && has('dispatch'),
          },
          {
            id: 'workOrders',
            titleKey: 'fleetWorkOrdersPage',
            descriptionKey: 'fleetWorkOrdersPageDescription',
            icon: HandymanRoundedIcon,
            path: '/fleet/work-orders',
            match: (pathname) =>
              pathname.startsWith('/fleet/work-order') || pathname.startsWith('/fleet/vendors'),
            visible: fleetMaintenance && has('workOrders'),
          },
          {
            id: 'inspections',
            titleKey: 'fleetInspectionsPage',
            descriptionKey: 'fleetInspectionsPageDescription',
            icon: FactCheckRoundedIcon,
            path: '/fleet/inspections',
            match: (pathname) => pathname.startsWith('/fleet/inspection'),
            visible: fleetInspections && has('inspections'),
          },
          {
            id: 'incidents',
            titleKey: 'fleetIncidentsPage',
            descriptionKey: 'fleetIncidentsPageDescription',
            icon: CarCrashRoundedIcon,
            path: '/fleet/incidents',
            match: (pathname) => pathname.startsWith('/fleet/incident'),
            visible: fleetIncidents && has('incidents'),
          },
          {
            id: 'maintenance',
            titleKey: 'sharedMaintenance',
            descriptionKey: 'settingsMaintenanceDescription',
            icon: BuildRoundedIcon,
            path: '/settings/maintenances',
            match: (pathname) => pathname.startsWith('/settings/maintenance'),
            visible: !readonly && !features.disableMaintenance,
          },
        ],
      },
      {
        id: 'fleetAssets',
        titleKey: 'fleetGroupAssets',
        items: [
          {
            id: 'devices',
            titleKey: 'deviceTitle',
            descriptionKey: 'settingsDevicesDescription',
            icon: DnsRoundedIcon,
            path: '/fleet/vehicles',
            match: (pathname) =>
              pathname.startsWith('/fleet/vehicle') ||
              pathname.startsWith('/settings/device') ||
              pathname.startsWith('/settings/accumulators'),
            // ADM-03: a viewer reads the vehicles (the list is read only for them).
            visible: !readonly || fleetVehicles,
          },
          {
            id: 'drivers',
            titleKey: 'sharedDrivers',
            descriptionKey: 'settingsDriversDescription',
            icon: BadgeRoundedIcon,
            path: '/fleet/drivers',
            match: (pathname) =>
              pathname.startsWith('/fleet/drivers') || pathname.startsWith('/settings/driver'),
            visible: (!readonly || fleetDrivers) && !features.disableDrivers,
          },
          {
            id: 'equipment',
            titleKey: 'fleetEquipmentPage',
            descriptionKey: 'fleetEquipmentPageDescription',
            icon: RvHookupRoundedIcon,
            path: '/fleet/equipment',
            match: (pathname) => pathname.startsWith('/fleet/equipment'),
            visible: fleetVehicles && has('equipment'),
          },
          {
            id: 'sensors',
            titleKey: 'fleetSensorsPage',
            descriptionKey: 'fleetSensorsPageDescription',
            icon: ThermostatRoundedIcon,
            path: '/fleet/sensors',
            match: (pathname) => pathname.startsWith('/fleet/sensors'),
            visible: has('sensors'),
          },
          {
            id: 'poi',
            titleKey: 'fleetPoiPage',
            descriptionKey: 'fleetPoiPageDescription',
            icon: PlaceRoundedIcon,
            path: '/fleet/poi',
            match: (pathname) => pathname.startsWith('/fleet/poi'),
            visible: fleetPoi && has('poi'),
          },
        ],
      },
      {
        id: 'fleetValidity',
        titleKey: 'fleetGroupValidity',
        items: [
          {
            id: 'expiries',
            titleKey: 'fleetExpiriesPage',
            descriptionKey: 'fleetExpiriesPageDescription',
            icon: EventAvailableRoundedIcon,
            path: '/fleet/expiries',
            match: (pathname) => pathname.startsWith('/fleet/expiries'),
          },
          {
            id: 'fleetAlerts',
            titleKey: 'fleetAlertsPage',
            descriptionKey: 'fleetAlertsPageDescription',
            icon: NotificationsActiveRoundedIcon,
            path: '/fleet/alerts',
            match: (pathname) =>
              pathname.startsWith('/fleet/alerts') &&
              !pathname.startsWith('/fleet/alerts/response'),
            visible: fleetAlerts && has('alerts'),
          },
          {
            id: 'alertResponse',
            titleKey: 'alertResponseTitle',
            descriptionKey: 'alertResponseMenuDescription',
            icon: TimerRoundedIcon,
            path: '/fleet/alerts/response',
            match: (pathname) => pathname.startsWith('/fleet/alerts/response'),
            visible: fleetAlerts && has('alertCases'),
          },
          {
            id: 'fleetDocuments',
            titleKey: 'fleetDocumentsPage',
            descriptionKey: 'fleetDocumentsPageDescription',
            icon: DescriptionRoundedIcon,
            path: '/settings/fleet-documents',
            match: (pathname) => pathname.startsWith('/settings/fleet-documents'),
            visible: fleetDocuments,
          },
        ],
      },
      {
        id: 'fleetCosts',
        titleKey: 'fleetGroupCosts',
        items: [
          {
            id: 'costs',
            titleKey: 'fleetCostsPage',
            descriptionKey: 'fleetCostsPageDescription',
            icon: LocalGasStationRoundedIcon,
            path: '/fleet/costs',
            match: (pathname) => pathname.startsWith('/fleet/costs'),
            visible: fleetCosts && has('costs'),
          },
          {
            id: 'fuelChecks',
            titleKey: 'fuelChecksTitle',
            descriptionKey: 'fuelChecksDescription',
            icon: SavingsRoundedIcon,
            path: '/fleet/fuel-checks',
            match: (pathname) => pathname.startsWith('/fleet/fuel-checks'),
            visible: fleetCosts && has('costs'),
          },
        ],
      },
      {
        id: 'fleetSafety',
        titleKey: 'fleetGroupSafety',
        items: [
          {
            id: 'safety',
            titleKey: 'fleetSafetyPage',
            descriptionKey: 'fleetSafetyPageDescription',
            icon: HealthAndSafetyRoundedIcon,
            path: '/fleet/safety',
            match: (pathname) =>
              (pathname.startsWith('/fleet/safety') &&
                !pathname.startsWith('/fleet/safety-officer')) ||
              pathname.startsWith('/fleet/driver-file'),
            visible: fleetSafety && has('safety'),
          },
          {
            id: 'safetyOfficer',
            titleKey: 'safetyOfficerPage',
            descriptionKey: 'safetyOfficerPageDescription',
            icon: AssignmentTurnedInRoundedIcon,
            path: '/fleet/safety-officer',
            match: (pathname) => pathname.startsWith('/fleet/safety-officer'),
            visible: fleetSafety && has('safetyOfficer'),
          },
        ],
      },
    ];
    return { settings: tidy(settings), fleet: tidy(fleet) };
  }, [
    readonly,
    admin,
    manager,
    features,
    userId,
    supportLink,
    billingLink,
    fleetDocuments,
    fleetAlerts,
    fleetMaintenance,
    fleetIncidents,
    fleetCosts,
    fleetInspections,
    fleetUsers,
    fleetSafety,
    fleetPoi,
    fleetDispatch,
    fleetVehicles,
    fleetDrivers,
    fleetIntegrations,
    fleetPrivacy,
    fleetUsersManage,
    fleetFeatures,
  ]);
};

export const useSettingsSections = () => useSectionCatalog().settings;

export const useFleetSections = () => useSectionCatalog().fleet;

// Every page of both areas, for the command palette.
export const useSettingsSectionItems = () => {
  const { settings, fleet } = useSectionCatalog();
  return useMemo(
    () =>
      [...fleet, ...settings].flatMap((section) =>
        section.items.map((item) => ({ ...item, groupKey: section.titleKey })),
      ),
    [settings, fleet],
  );
};
