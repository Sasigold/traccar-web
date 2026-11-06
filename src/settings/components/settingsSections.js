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
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAdministrator, useManager, useRestriction } from '../../common/util/permissions';
import useFeatures from '../../common/util/useFeatures';
import { useFleetPermission } from '../../common/fleet/useFleet';

// Single source of truth for the settings area: drives the settings menu,
// the settings hub cards and the command palette.
export const useSettingsSections = () => {
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

  return useMemo(() => {
    const profilePath = `/settings/user/${userId}`;
    const groups = [
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
            titleKey: 'sharedNotifications',
            descriptionKey: 'settingsNotificationsDescription',
            icon: NotificationsRoundedIcon,
            path: '/settings/notifications',
            match: (pathname) => pathname.startsWith('/settings/notification'),
            visible: !readonly,
          },
        ],
      },
      {
        id: 'fleet',
        titleKey: 'settingsGroupFleet',
        visible: !readonly,
        items: [
          {
            id: 'devices',
            titleKey: 'deviceTitle',
            descriptionKey: 'settingsDevicesDescription',
            icon: DnsRoundedIcon,
            path: '/settings/devices',
            match: (pathname) => pathname.startsWith('/settings/device'),
          },
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
            id: 'drivers',
            titleKey: 'sharedDrivers',
            descriptionKey: 'settingsDriversDescription',
            icon: BadgeRoundedIcon,
            path: '/settings/drivers',
            match: (pathname) => pathname.startsWith('/settings/driver'),
            visible: !features.disableDrivers,
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
            id: 'maintenance',
            titleKey: 'sharedMaintenance',
            descriptionKey: 'settingsMaintenanceDescription',
            icon: BuildRoundedIcon,
            path: '/settings/maintenances',
            match: (pathname) => pathname.startsWith('/settings/maintenance'),
            visible: !features.disableMaintenance,
          },
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
            match: (pathname) => pathname.startsWith('/fleet/alerts'),
            visible: fleetAlerts,
          },
          {
            id: 'workOrders',
            titleKey: 'fleetWorkOrdersPage',
            descriptionKey: 'fleetWorkOrdersPageDescription',
            icon: HandymanRoundedIcon,
            path: '/fleet/work-orders',
            match: (pathname) =>
              pathname.startsWith('/fleet/work-order') || pathname.startsWith('/fleet/vendors'),
            visible: fleetMaintenance,
          },
          {
            id: 'incidents',
            titleKey: 'fleetIncidentsPage',
            descriptionKey: 'fleetIncidentsPageDescription',
            icon: CarCrashRoundedIcon,
            path: '/fleet/incidents',
            match: (pathname) => pathname.startsWith('/fleet/incident'),
            visible: fleetIncidents,
          },
          {
            id: 'inspections',
            titleKey: 'fleetInspectionsPage',
            descriptionKey: 'fleetInspectionsPageDescription',
            icon: FactCheckRoundedIcon,
            path: '/fleet/inspections',
            match: (pathname) => pathname.startsWith('/fleet/inspection'),
            visible: fleetInspections,
          },
          {
            id: 'costs',
            titleKey: 'fleetCostsPage',
            descriptionKey: 'fleetCostsPageDescription',
            icon: LocalGasStationRoundedIcon,
            path: '/fleet/costs',
            match: (pathname) => pathname.startsWith('/fleet/costs'),
            visible: fleetCosts,
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
        id: 'automation',
        titleKey: 'settingsGroupAutomation',
        visible: !readonly,
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
          },
        ],
      },
      {
        id: 'help',
        titleKey: 'settingsGroupHelp',
        items: [
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
    return groups
      .filter((group) => group.visible !== false)
      .map((group) => ({ ...group, items: group.items.filter((item) => item.visible !== false) }))
      .filter((group) => group.items.length > 0);
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
  ]);
};

export const useSettingsSectionItems = () => {
  const sections = useSettingsSections();
  return useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.map((item) => ({ ...item, groupKey: section.titleKey })),
      ),
    [sections],
  );
};
