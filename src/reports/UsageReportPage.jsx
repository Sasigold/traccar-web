import { useCallback } from 'react';
import { TextField } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference } from '../common/util/preferences';
import usePersistedState from '../common/util/usePersistedState';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatDistance } from '../common/util/formatter';
import { formatHours } from '../dashboard/data/format';
import { loadPrivacy } from '../common/fleet/privacyData';
import { money } from '../fleet/fleetData';
import useReportStyles from './common/useReportStyles';
import FleetTableReport from './components/FleetTableReport';
import { usageByVehicle } from './common/fleetReports';

const DAY = 24 * 60 * 60 * 1000;

export const loadReportRows = async (type, { deviceIds, groupIds, from, to }, params = {}) => {
  const query = new URLSearchParams({ from, to, ...params });
  deviceIds.forEach((id) => query.append('deviceId', id));
  groupIds.forEach((id) => query.append('groupId', id));
  const response = await fetchOrThrow(`api/reports/${type}?${query}`, {
    headers: { Accept: 'application/json' },
  });
  return response.json();
};

// /reports/usage (REP-23): how much each vehicle was used, idling and what it cost, driving after
// hours and on rest days, and private kilometers.
const UsageReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  const [idleBurn, setIdleBurn] = usePersistedState('usageIdleBurn', '0.8');
  const [fuelPrice, setFuelPrice] = usePersistedState('usageFuelPrice', '');

  const load = useCallback(
    async (scope) => {
      const [trips, stops, privacy] = await Promise.all([
        loadReportRows('trips', scope),
        loadReportRows('stops', scope),
        loadPrivacy(scope.from, scope.to),
      ]);
      const days = Math.max(1, Math.round((Date.parse(scope.to) - Date.parse(scope.from)) / DAY));
      return usageByVehicle(scope.devices, trips, stops, {
        policy: privacy?.policy,
        periods: privacy?.periods,
        days,
        idleBurn,
        fuelPrice,
      });
    },
    [idleBurn, fuelPrice],
  );

  const km = (value) => formatDistance(value, distanceUnit, t);
  const hours = (value) => formatHours(value / 3600000);
  const columns = [
    { key: 'distance', labelKey: 'sharedDistance', format: km, exportValue: (v) => v / 1000 },
    { key: 'drivingTime', labelKey: 'dashboardMDrivingTime', format: hours, exportValue: hours },
    { key: 'activeDays', labelKey: 'usageActiveDays' },
    {
      key: 'utilization',
      labelKey: 'usageUtilization',
      format: (v) => (v == null ? '—' : `${Math.round(v)}%`),
      exportValue: (v) => (v == null ? '' : Math.round(v)),
    },
    { key: 'idleTime', labelKey: 'dashboardMIdleTime', format: hours, exportValue: hours },
    {
      key: 'idleCost',
      labelKey: 'usageIdleCost',
      format: (v) => (v == null ? '—' : money(v)),
      exportValue: (v) => (v == null ? '' : Math.round(v)),
    },
    {
      key: 'afterHoursDistance',
      labelKey: 'usageAfterHours',
      format: km,
      exportValue: (v) => v / 1000,
    },
    { key: 'restDayDistance', labelKey: 'usageRestDays', format: km, exportValue: (v) => v / 1000 },
    { key: 'privateDistance', labelKey: 'usagePrivate', format: km, exportValue: (v) => v / 1000 },
  ];

  return (
    <FleetTableReport
      reportKey="usage"
      titleKey="reportUsage"
      columns={columns}
      totals={{
        distance: 'sum',
        drivingTime: 'sum',
        activeDays: 'sum',
        idleTime: 'sum',
        idleCost: 'sum',
        afterHoursDistance: 'sum',
        restDayDistance: 'sum',
        privateDistance: 'sum',
      }}
      load={load}
      filterChildren={
        <>
          <div className={classes.filterItem}>
            <TextField
              type="number"
              label={t('usageIdleBurn')}
              helperText={t('usageIdleBurnHelp')}
              value={idleBurn}
              onChange={(event) => setIdleBurn(event.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', min: 0, step: 0.1 } }}
              fullWidth
            />
          </div>
          <div className={classes.filterItem}>
            <TextField
              type="number"
              label={t('usageFuelPrice')}
              helperText={t('usageFuelPriceHelp')}
              value={fuelPrice}
              onChange={(event) => setFuelPrice(event.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', min: 0, step: 0.01 } }}
              fullWidth
            />
          </div>
        </>
      }
    />
  );
};

export default UsageReportPage;
