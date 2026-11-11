import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import { getFleetClient } from '../common/fleet/client';
import { readAllRows } from '../common/data/fleetQuery';
import FleetTableReport from './components/FleetTableReport';
import { jobsByDriver } from './common/jobCompliance';

// /reports/jobs (REP-23): how each driver kept the jobs' time windows: jobs, done, on time, late
// and failed, for the vehicles chosen in the filter.
const JobsReportPage = () => {
  const t = useTranslation();
  const fleetReady = useSelector((state) => state.fleet.status === 'ready');

  const load = useCallback(
    async (scope) => {
      if (!fleetReady) return [];
      const jobs = await readAllRows('dispatch_jobs', () =>
        getFleetClient()
          .from('dispatch_jobs')
          .select(
            'id, status, driver_id, scheduled_at, window_end, arrived_at, completed_at, vehicles(traccar_device_id), drivers(full_name, traccar_driver_id)',
          )
          .gte('scheduled_at', new Date(scope.from).toISOString())
          .lte('scheduled_at', new Date(scope.to).toISOString())
          .order('scheduled_at'),
      );
      const inScope = new Set(scope.devices.map((device) => device.id));
      return jobsByDriver(
        jobs.filter((job) => inScope.has(job.vehicles?.traccar_device_id)),
        t('reportJobsNoDriver'),
      );
    },
    [fleetReady, t],
  );

  const percent = (value) => (value == null ? '—' : `${value}%`);
  const columns = [
    { key: 'jobs', labelKey: 'reportJobsCount' },
    { key: 'done', labelKey: 'reportJobsDone' },
    { key: 'onTime', labelKey: 'reportJobsOnTime' },
    { key: 'late', labelKey: 'reportJobsLate' },
    { key: 'failed', labelKey: 'reportJobsFailed' },
    {
      key: 'onTimeShare',
      labelKey: 'reportJobsOnTimeShare',
      format: percent,
      exportValue: (value) => (value == null ? '' : value),
    },
  ];

  return (
    <FleetTableReport
      reportKey="jobs"
      titleKey="reportJobs"
      nameLabelKey="sharedDriver"
      rowKey={(item) => item.driverId}
      rowLink={(item) =>
        item.traccarDriverId ? `/fleet/driver-file/${item.traccarDriverId}` : null
      }
      columns={columns}
      compared={['jobs', 'onTimeShare']}
      totals={{ jobs: 'sum', done: 'sum', onTime: 'sum', late: 'sum', failed: 'sum' }}
      load={load}
    />
  );
};

export default JobsReportPage;
