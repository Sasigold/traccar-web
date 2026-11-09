import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Chip } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import { formatTime } from '../common/util/formatter';
import FleetTableReport from './components/FleetTableReport';
import { deviceHealth } from './common/fleetReports';
import { loadReportRows } from './UsageReportPage';

// /reports/device-health (REP-23): devices that went silent, lost power or report fault codes.
const DeviceHealthReportPage = () => {
  const t = useTranslation();
  const positions = useSelector((state) => state.session.positions);

  const load = useCallback(
    async (scope) => {
      const events = await loadReportRows('events', scope, { type: 'alarm' });
      return deviceHealth(scope.devices, positions, events);
    },
    [positions],
  );

  const columns = [
    {
      key: 'lastUpdate',
      labelKey: 'deviceLastUpdate',
      format: (v) => (v ? formatTime(v, 'minutes') : '—'),
    },
    {
      key: 'silentHours',
      labelKey: 'healthSilent',
      format: (v, row) =>
        row.silent ? (
          <Chip
            size="small"
            color="error"
            label={
              v == null ? t('healthNever') : t('healthSilentFor').replace('{0}', Math.floor(v))
            }
          />
        ) : (
          t('healthOk')
        ),
      exportValue: (v) => (v == null ? '' : Math.floor(v)),
    },
    { key: 'powerCuts', labelKey: 'healthPowerCuts' },
    { key: 'lowBattery', labelKey: 'healthLowBattery' },
    {
      key: 'dtcs',
      labelKey: 'healthDtcs',
      format: (v) => (v.length ? <bdi dir="ltr">{v.join(', ')}</bdi> : '—'),
      exportValue: (v) => v.join(', '),
    },
  ];

  return (
    <FleetTableReport
      reportKey="deviceHealth"
      titleKey="reportDeviceHealth"
      columns={columns}
      totals={{ powerCuts: 'sum', lowBattery: 'sum' }}
      load={load}
    />
  );
};

export default DeviceHealthReportPage;
