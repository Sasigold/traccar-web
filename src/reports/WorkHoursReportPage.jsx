import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { formatHours } from '../dashboard/data/format';
import FleetTableReport from './components/FleetTableReport';
import { loadReportRows } from './UsageReportPage';
import { weeklyTotals, workDays } from './common/workHours';
import { getFleetClient } from '../common/fleet/client';

// /reports/work-hours (OPS-05): each driver's working days from the first to the last ignition,
// with the driving time inside them, for payroll (the export opens in Hilan or Malam as Excel).
// A check-in from the driver area before the first ignition starts the day there.
const WorkHoursReportPage = () => {
  const drivers = useSelector((state) => state.drivers.items);
  const fleetReady = useSelector((state) => state.fleet.status === 'ready');

  const load = useCallback(
    async (scope) => {
      const trips = await loadReportRows('trips', scope);
      // OPS-05: the drivers' check-ins in the period, by their Traccar driver's identifier.
      const byId = Object.fromEntries(Object.values(drivers).map((item) => [item.id, item]));
      const checkins = fleetReady
        ? (
            (
              await getFleetClient()
                .from('vehicle_driver_assignments')
                .select('starts_at, drivers(traccar_driver_id)')
                .eq('source', 'checkin')
                .gte('starts_at', new Date(scope.from).toISOString())
                .lte('starts_at', new Date(scope.to).toISOString())
            ).data || []
          ).map((row) => ({
            driver: byId[row.drivers?.traccar_driver_id]?.uniqueId,
            time: row.starts_at,
          }))
        : [];
      return weeklyTotals(workDays(trips, checkins)).map((row) => ({
        ...row,
        name: drivers[row.driver]?.name || row.driver,
        averageMs: row.days ? row.spanMs / row.days : 0,
      }));
    },
    [drivers, fleetReady],
  );

  const hours = (value) => formatHours(value / 3600000);
  const columns = [
    { key: 'days', labelKey: 'workDaysCount' },
    { key: 'spanMs', labelKey: 'workHoursTotal', format: hours, exportValue: hours },
    { key: 'averageMs', labelKey: 'workHoursAverage', format: hours, exportValue: hours },
    { key: 'drivingMs', labelKey: 'dashboardMDrivingTime', format: hours, exportValue: hours },
  ];

  return (
    <FleetTableReport
      reportKey="workHours"
      titleKey="reportWorkHours"
      nameLabelKey="sharedDriver"
      rowKey={(item) => item.driver}
      rowLink={(item) =>
        drivers[item.driver] ? `/fleet/driver-file/${drivers[item.driver].id}` : null
      }
      columns={columns}
      totals={{ days: 'sum', spanMs: 'sum', drivingMs: 'sum' }}
      load={load}
    />
  );
};

export default WorkHoursReportPage;
