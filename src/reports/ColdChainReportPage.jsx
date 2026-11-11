import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { formatHours } from '../dashboard/data/format';
import FleetTableReport from './components/FleetTableReport';
import { loadReportRows } from './UsageReportPage';
import { coldChainOf } from './common/coldChain';

const degrees = (value) => (value == null ? '—' : `${Math.round(value * 10) / 10}°`);

// /reports/cold-chain (REP-23): for each vehicle with temperature limits (set on the sensors
// page), how many times and for how long a sensor left the range in the period, and the lowest
// and highest reading.
const ColdChainReportPage = () => {
  const fleetReady = useSelector((state) => state.fleet.status === 'ready');

  const load = useCallback(
    async (scope) => {
      if (!fleetReady) return [];
      const limits = (
        unwrap(
          await getFleetClient()
            .from('vehicles')
            .select('traccar_device_id, temp_min, temp_max')
            .or('temp_min.not.is.null,temp_max.not.is.null'),
        ) || []
      ).filter(
        (row) => row.traccar_device_id != null && (row.temp_min != null || row.temp_max != null),
      );
      const byDevice = Object.fromEntries(limits.map((row) => [row.traccar_device_id, row]));
      const devices = scope.devices.filter((device) => byDevice[device.id]);
      if (!devices.length) return [];
      const positions = await loadReportRows('route', {
        ...scope,
        deviceIds: devices.map((device) => device.id),
        groupIds: [],
      });
      return devices.map((device) => {
        const limit = byDevice[device.id];
        return {
          deviceId: device.id,
          name: device.name,
          range: [limit.temp_min, limit.temp_max]
            .map((value) => (value == null ? '' : `${value}°`))
            .join(' – '),
          ...coldChainOf(
            positions.filter((position) => position.deviceId === device.id),
            limit,
          ),
        };
      });
    },
    [fleetReady],
  );

  const hours = (value) => formatHours(value / 3600000);
  const columns = [
    {
      key: 'range',
      labelKey: 'reportColdChainRange',
      // From the lowest to the highest, left to right in a Hebrew page too.
      format: (value) => <bdi dir="ltr">{value}</bdi>,
    },
    { key: 'excursions', labelKey: 'reportColdChainExcursions' },
    { key: 'outMs', labelKey: 'reportColdChainOutTime', format: hours, exportValue: hours },
    { key: 'min', labelKey: 'reportColdChainMin', format: degrees, exportValue: (v) => v ?? '' },
    { key: 'max', labelKey: 'reportColdChainMax', format: degrees, exportValue: (v) => v ?? '' },
    { key: 'readings', labelKey: 'reportColdChainReadings' },
  ];

  return (
    <FleetTableReport
      reportKey="coldChain"
      titleKey="reportColdChain"
      columns={columns}
      compared={['excursions', 'outMs']}
      totals={{ excursions: 'sum', outMs: 'sum', readings: 'sum' }}
      load={load}
    />
  );
};

export default ColdChainReportPage;
