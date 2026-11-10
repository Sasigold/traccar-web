import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import MainPage from './main/MainPage';
import App from './App';
import Loader from './common/components/Loader';
import AdminRoute from './admin/AdminRoute';
import ReportVisits from './reports/components/ReportVisits';
import { useAsyncTask } from './reactHelper';
import { devicesActions } from './store';
import { generateLoginToken } from './common/components/NativeInterface';
import { useLocalization } from './common/components/LocalizationProvider';
import fetchOrThrow from './common/util/fetchOrThrow';

// The vehicle and driver lists moved to the fleet area (ADM-02); old links keep their filters.
const KeepQuery = ({ to }) => {
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  return <Navigate to={query ? `${to}?${query}` : to} replace />;
};

const NotFoundPage = lazy(() => import('./other/NotFoundPage'));
const DashboardPage = lazy(() => import('./dashboard/DashboardPage'));
const FleetHubPage = lazy(() => import('./fleet/FleetHubPage'));
const ExpiriesPage = lazy(() => import('./fleet/ExpiriesPage'));
const AlertsPage = lazy(() => import('./fleet/AlertsPage'));
const WorkOrdersPage = lazy(() => import('./fleet/WorkOrdersPage'));
const WorkOrderPage = lazy(() => import('./fleet/WorkOrderPage'));
const VendorsPage = lazy(() => import('./fleet/VendorsPage'));
const IncidentsPage = lazy(() => import('./fleet/IncidentsPage'));
const IncidentPage = lazy(() => import('./fleet/IncidentPage'));
const CostsPage = lazy(() => import('./fleet/CostsPage'));
const InspectionsPage = lazy(() => import('./fleet/InspectionsPage'));
const InspectionPage = lazy(() => import('./fleet/InspectionPage'));
const RolesPage = lazy(() => import('./fleet/RolesPage'));
const FleetUsersPage = lazy(() => import('./fleet/FleetUsersPage'));
const DriverPortalPage = lazy(() => import('./fleet/DriverPortalPage'));
const DriverDamagePage = lazy(() => import('./fleet/DriverDamagePage'));
const SafetyPage = lazy(() => import('./fleet/SafetyPage'));
const VehiclePage = lazy(() => import('./fleet/VehiclePage'));
const VehicleWizardPage = lazy(() => import('./fleet/VehicleWizardPage'));
const SafetyOfficerPage = lazy(() => import('./fleet/SafetyOfficerPage'));
const PrivacyPage = lazy(() => import('./fleet/PrivacyPage'));
const AiSettingsPage = lazy(() => import('./fleet/AiSettingsPage'));
const SafetyInboxPage = lazy(() => import('./fleet/SafetyInboxPage'));
const DriverCheckInPage = lazy(() => import('./fleet/DriverCheckInPage'));
const FuelChecksPage = lazy(() => import('./fleet/FuelChecksPage'));
const DriverFilePage = lazy(() => import('./fleet/DriverFilePage'));
const PoiPage = lazy(() => import('./fleet/PoiPage'));
const DispatchPage = lazy(() => import('./fleet/DispatchPage'));
const EquipmentPage = lazy(() => import('./fleet/EquipmentPage'));
const SensorsPage = lazy(() => import('./fleet/SensorsPage'));
const IntegrationsPage = lazy(() => import('./fleet/IntegrationsPage'));
const ApiDocsPage = lazy(() => import('./fleet/ApiDocsPage'));
const ReportsHubPage = lazy(() => import('./reports/ReportsHubPage'));
const TimelineReportPage = lazy(() => import('./reports/TimelineReportPage'));
const UsageReportPage = lazy(() => import('./reports/UsageReportPage'));
const CostPerKmReportPage = lazy(() => import('./reports/CostPerKmReportPage'));
const DeviceHealthReportPage = lazy(() => import('./reports/DeviceHealthReportPage'));
const CombinedReportPage = lazy(() => import('./reports/CombinedReportPage'));
const PositionsReportPage = lazy(() => import('./reports/PositionsReportPage'));
const ServerPage = lazy(() => import('./settings/ServerPage'));
const UsersPage = lazy(() => import('./settings/UsersPage'));
const DevicePage = lazy(() => import('./settings/DevicePage'));
const UserPage = lazy(() => import('./settings/UserPage'));
const NotificationsPage = lazy(() => import('./settings/NotificationsPage'));
const NotificationPage = lazy(() => import('./settings/NotificationPage'));
const GroupsPage = lazy(() => import('./settings/GroupsPage'));
const GroupPage = lazy(() => import('./settings/GroupPage'));
const PositionPage = lazy(() => import('./other/PositionPage'));
const TelemetryPage = lazy(() => import('./other/TelemetryPage'));
const NetworkPage = lazy(() => import('./other/NetworkPage'));
const EventReportPage = lazy(() => import('./reports/EventReportPage'));
const GeofenceReportPage = lazy(() => import('./reports/GeofenceReportPage'));
const ReplayPage = lazy(() => import('./other/ReplayPage'));
const TripReportPage = lazy(() => import('./reports/TripReportPage'));
const StopReportPage = lazy(() => import('./reports/StopReportPage'));
const SummaryReportPage = lazy(() => import('./reports/SummaryReportPage'));
const ChartReportPage = lazy(() => import('./reports/ChartReportPage'));
const DriversPage = lazy(() => import('./settings/DriversPage'));
const DriverPage = lazy(() => import('./settings/DriverPage'));
const FleetDocumentsPage = lazy(() => import('./settings/FleetDocumentsPage'));
const ProtocolsPage = lazy(() => import('./settings/ProtocolsPage'));
const CalendarsPage = lazy(() => import('./settings/CalendarsPage'));
const CalendarPage = lazy(() => import('./settings/CalendarPage'));
const ComputedAttributesPage = lazy(() => import('./settings/ComputedAttributesPage'));
const ComputedAttributePage = lazy(() => import('./settings/ComputedAttributePage'));
const MaintenancesPage = lazy(() => import('./settings/MaintenancesPage'));
const MaintenancePage = lazy(() => import('./settings/MaintenancePage'));
const CommandsPage = lazy(() => import('./settings/CommandsPage'));
const CommandPage = lazy(() => import('./settings/CommandPage'));
const DeviceStatisticsPage = lazy(() => import('./reports/DeviceStatisticsPage'));
const StatisticsPage = lazy(() => import('./reports/StatisticsPage'));
const LoginPage = lazy(() => import('./login/LoginPage'));
const AccessibilityPage = lazy(() => import('./other/AccessibilityPage'));
const RegisterPage = lazy(() => import('./login/RegisterPage'));
const ResetPasswordPage = lazy(() => import('./login/ResetPasswordPage'));
const GeofencesPage = lazy(() => import('./other/GeofencesPage'));
const GeofencePage = lazy(() => import('./settings/GeofencePage'));
const EventPage = lazy(() => import('./other/EventPage'));
const PreferencesPage = lazy(() => import('./settings/PreferencesPage'));
const AccumulatorsPage = lazy(() => import('./settings/AccumulatorsPage'));
const CommandDevicePage = lazy(() => import('./settings/CommandDevicePage'));
const CommandGroupPage = lazy(() => import('./settings/CommandGroupPage'));
const ChangeServerPage = lazy(() => import('./login/ChangeServerPage'));
const DevicesPage = lazy(() => import('./settings/DevicesPage'));
const ScheduledPage = lazy(() => import('./reports/ScheduledPage'));
const DeviceConnectionsPage = lazy(() => import('./settings/DeviceConnectionsPage'));
const GroupConnectionsPage = lazy(() => import('./settings/GroupConnectionsPage'));
const UserConnectionsPage = lazy(() => import('./settings/UserConnectionsPage'));
const LogsPage = lazy(() => import('./reports/LogsPage'));
const SharePage = lazy(() => import('./settings/SharePage'));
const AnnouncementPage = lazy(() => import('./settings/AnnouncementPage'));
const EmulatorPage = lazy(() => import('./other/EmulatorPage'));
const StreamPage = lazy(() => import('./other/StreamPage'));
const TodayPage = lazy(() => import('./main/TodayPage'));
const AuditPage = lazy(() => import('./reports/AuditPage'));
const SettingsHubPage = lazy(() => import('./settings/SettingsHubPage'));
const AdminOverviewPage = lazy(() => import('./admin/AdminOverviewPage'));
const CustomersPage = lazy(() => import('./admin/CustomersPage'));
const CustomerPage = lazy(() => import('./admin/CustomerPage'));
const AdminDevicesPage = lazy(() => import('./admin/AdminDevicesPage'));
const DeviceSetupPage = lazy(() => import('./admin/DeviceSetupPage'));
const AdminUsersPage = lazy(() => import('./admin/AdminUsersPage'));
const BillingPage = lazy(() => import('./admin/BillingPage'));
const PlansPage = lazy(() => import('./admin/PlansPage'));
const MessagingPage = lazy(() => import('./admin/MessagingPage'));
const ApiLimitsPage = lazy(() => import('./admin/ApiLimitsPage'));
const ClientHealthPage = lazy(() => import('./admin/ClientHealthPage'));
const InvoicingPage = lazy(() => import('./admin/InvoicingPage'));

const Navigation = () => {
  const dispatch = useDispatch();
  const { setLocalLanguage } = useLocalization();

  const [searchParams, setSearchParams] = useSearchParams();

  const hasQueryParams = ['locale', 'token', 'uniqueId', 'openid'].some((key) =>
    searchParams.has(key),
  );

  useAsyncTask(
    async ({ signal }) => {
      if (!hasQueryParams) {
        return;
      }

      const newParams = new URLSearchParams(searchParams);

      if (searchParams.has('locale')) {
        setLocalLanguage(searchParams.get('locale'));
        newParams.delete('locale');
      }

      if (searchParams.has('token')) {
        const token = searchParams.get('token');
        await fetch(`api/session?token=${encodeURIComponent(token)}`, { signal });
        newParams.delete('token');
      }

      if (searchParams.has('uniqueId')) {
        const response = await fetchOrThrow(
          `api/devices?uniqueId=${searchParams.get('uniqueId')}`,
          { signal },
        );
        const items = await response.json();
        if (items.length > 0) {
          dispatch(devicesActions.selectId(items[0].id));
        }
        newParams.delete('uniqueId');
      }

      if (searchParams.has('openid')) {
        if (searchParams.get('openid') === 'success') {
          generateLoginToken();
        }
        newParams.delete('openid');
      }

      setSearchParams(newParams, { replace: true });
    },
    [hasQueryParams, searchParams, setSearchParams, dispatch, setLocalLanguage],
  );

  if (hasQueryParams) {
    return <Loader />;
  }
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* A11-07: open without signing in. */}
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-server" element={<ChangeServerPage />} />
        <Route path="/" element={<App />}>
          <Route index element={<MainPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="today" element={<TodayPage />} />

          <Route path="position/:id" element={<PositionPage />} />
          <Route path="telemetry/:deviceId" element={<TelemetryPage />} />
          <Route path="network/:positionId" element={<NetworkPage />} />
          <Route path="event/:id" element={<EventPage />} />
          <Route element={<ReportVisits />}>
            <Route path="replay" element={<ReplayPage />} />
          </Route>
          <Route path="geofences" element={<GeofencesPage />} />
          <Route path="emulator" element={<EmulatorPage />} />
          <Route path="stream" element={<StreamPage />} />

          <Route path="driver">
            <Route index element={<DriverPortalPage />} />
            <Route path="check" element={<InspectionPage driverMode />} />
            <Route path="damage" element={<DriverDamagePage />} />
            <Route path="checkin" element={<DriverCheckInPage />} />
          </Route>
          <Route path="fleet">
            <Route index element={<FleetHubPage />} />
            <Route path="expiries" element={<ExpiriesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="work-order/:id" element={<WorkOrderPage />} />
            <Route path="work-order" element={<WorkOrderPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incident/:id" element={<IncidentPage />} />
            <Route path="incident" element={<IncidentPage />} />
            <Route path="costs" element={<CostsPage />} />
            <Route path="fuel-checks" element={<FuelChecksPage />} />
            <Route path="inspections" element={<InspectionsPage />} />
            <Route path="inspection/:id" element={<InspectionPage />} />
            <Route path="inspection" element={<InspectionPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="users" element={<FleetUsersPage />} />
            <Route path="safety" element={<SafetyPage />} />
            <Route path="safety/inbox" element={<SafetyInboxPage />} />
            <Route path="safety-officer" element={<SafetyOfficerPage />} />
            <Route path="driver-file/:id" element={<DriverFilePage />} />
            <Route path="poi" element={<PoiPage />} />
            <Route path="dispatch" element={<DispatchPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="sensors" element={<SensorsPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="integrations/api" element={<ApiDocsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="ai" element={<AiSettingsPage />} />
            <Route path="vehicles" element={<DevicesPage />} />
            <Route path="vehicle/new" element={<VehicleWizardPage />} />
            <Route path="vehicle/:id" element={<VehiclePage />} />
            <Route path="drivers" element={<DriversPage />} />
          </Route>

          <Route path="settings">
            <Route index element={<SettingsHubPage />} />
            <Route path=":type/:id/share" element={<SharePage />} />
            <Route path="accumulators/:deviceId" element={<AccumulatorsPage />} />
            <Route path="announcement" element={<AnnouncementPage />} />
            <Route path="protocols" element={<ProtocolsPage />} />
            <Route path="calendars" element={<CalendarsPage />} />
            <Route path="calendar/:id" element={<CalendarPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="commands" element={<CommandsPage />} />
            <Route path="command/:id" element={<CommandPage />} />
            <Route path="command" element={<CommandPage />} />
            <Route path="attributes" element={<ComputedAttributesPage />} />
            <Route path="attribute/:id" element={<ComputedAttributePage />} />
            <Route path="attribute" element={<ComputedAttributePage />} />
            <Route path="devices" element={<KeepQuery to="/fleet/vehicles" />} />
            <Route path="device/:id/connections" element={<DeviceConnectionsPage />} />
            <Route path="device/:id/command" element={<CommandDevicePage />} />
            <Route path="device/:id" element={<DevicePage />} />
            <Route path="device" element={<DevicePage />} />
            <Route path="drivers" element={<KeepQuery to="/fleet/drivers" />} />
            <Route path="driver/:id" element={<DriverPage />} />
            <Route path="driver" element={<DriverPage />} />
            <Route path="fleet-documents" element={<FleetDocumentsPage />} />
            <Route path="geofence/:id" element={<GeofencePage />} />
            <Route path="geofence" element={<GeofencePage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="group/:id/connections" element={<GroupConnectionsPage />} />
            <Route path="group/:id/command" element={<CommandGroupPage />} />
            <Route path="group/:id" element={<GroupPage />} />
            <Route path="group" element={<GroupPage />} />
            <Route path="maintenances" element={<MaintenancesPage />} />
            <Route path="maintenance/:id" element={<MaintenancePage />} />
            <Route path="maintenance" element={<MaintenancePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="notification/:id" element={<NotificationPage />} />
            <Route path="notification" element={<NotificationPage />} />
            <Route path="preferences" element={<PreferencesPage />} />
            <Route path="server" element={<ServerPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="user/:id/connections" element={<UserConnectionsPage />} />
            <Route path="user/:id" element={<UserPage />} />
            <Route path="user" element={<UserPage />} />
          </Route>

          <Route path="admin" element={<AdminRoute />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customer/:id" element={<CustomerPage />} />
            <Route path="customer" element={<CustomerPage />} />
            <Route path="devices" element={<AdminDevicesPage />} />
            <Route path="device/:id" element={<DeviceSetupPage />} />
            <Route path="device" element={<DeviceSetupPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="messaging" element={<MessagingPage />} />
            <Route path="api" element={<ApiLimitsPage />} />
            <Route path="health" element={<ClientHealthPage />} />
            <Route path="invoicing" element={<InvoicingPage />} />
          </Route>

          <Route path="reports" element={<ReportVisits />}>
            <Route index element={<ReportsHubPage />} />
            <Route path="combined" element={<CombinedReportPage />} />
            <Route path="timeline" element={<TimelineReportPage />} />
            <Route path="usage" element={<UsageReportPage />} />
            <Route path="cost-per-km" element={<CostPerKmReportPage />} />
            <Route path="device-health" element={<DeviceHealthReportPage />} />
            <Route path="chart" element={<ChartReportPage />} />
            <Route path="events" element={<EventReportPage />} />
            <Route path="geofences" element={<GeofenceReportPage />} />
            <Route path="route" element={<PositionsReportPage />} />
            <Route path="stops" element={<StopReportPage />} />
            <Route path="summary" element={<SummaryReportPage />} />
            <Route path="trips" element={<TripReportPage />} />
            <Route path="scheduled" element={<ScheduledPage />} />
            <Route path="statistics" element={<StatisticsPage />} />
            <Route path="device-statistics" element={<DeviceStatisticsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="logs" element={<LogsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default Navigation;
