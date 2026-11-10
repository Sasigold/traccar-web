import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { formatHours } from '../dashboard/data/format';
import FleetTableReport from './components/FleetTableReport';
import { loadReportRows } from './UsageReportPage';
import { weeklyTotals, workDays } from './common/workHours';

// /reports/work-hours (OPS-05): each driver's working days from the first to the last ignition,
// with the driving time inside them, for payroll (the export opens in Hilan or Malam as Excel).
const WorkHoursReportPage = () => {
  const drivers = useSelector((state) => state.drivers.items);

  const load = useCallback(
    async (scope) => {
      const trips = await loadReportRows('trips', scope);
      return weeklyTotals(workDays(trips)).map((row) => ({
        ...row,
        name: drivers[row.driver]?.name || row.driver,
        averageMs: row.days ? row.spanMs / row.days : 0,
      }));
    },
    [drivers],
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
