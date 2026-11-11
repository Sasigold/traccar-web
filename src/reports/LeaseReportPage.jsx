import { useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance } from '../common/util/formatter';
import { odometerKm } from '../common/fleet/workOrders';
import { money } from '../fleet/fleetData';
import FleetTableReport from './components/FleetTableReport';
import { loadReportRows } from './UsageReportPage';
import { leaseRows } from './common/leaseReport';

// /reports/lease (REP-23): each leased vehicle's kilometers in the period against its share of the
// contract's quota, and where the whole contract is heading (ADM-31's lease fields).
const LeaseReportPage = () => {
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  const positions = useSelector((state) => state.session.positions);
  // The live positions change all the time; the report reads them when it runs.
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const load = useCallback(async (scope) => {
    const leased = scope.devices.filter((device) => device.attributes?.ownership === 'leased');
    if (!leased.length) return [];
    const summary = await loadReportRows('summary', {
      ...scope,
      deviceIds: leased.map((device) => device.id),
      groupIds: [],
    });
    return leaseRows(
      leased,
      summary,
      (deviceId) => odometerKm(positionsRef.current[deviceId]),
      scope.from,
      scope.to,
    );
  }, []);

  const km = (value) => (value == null ? '—' : formatDistance(value, distanceUnit, t));
  const kmExport = (value) => (value == null ? '' : Math.round(value / 1000));
  const columns = [
    { key: 'distance', labelKey: 'sharedDistance', format: km, exportValue: kmExport },
    { key: 'allowance', labelKey: 'reportLeaseAllowance', format: km, exportValue: kmExport },
    {
      key: 'allowanceShare',
      labelKey: 'reportLeaseAllowanceShare',
      format: (value) => (value == null ? '—' : `${value}%`),
      exportValue: (value) => (value == null ? '' : value),
    },
    { key: 'used', labelKey: 'reportLeaseUsed', format: km, exportValue: kmExport },
    { key: 'quota', labelKey: 'fleetLeaseKmQuota', format: km, exportValue: kmExport },
    { key: 'projected', labelKey: 'reportLeaseProjected', format: km, exportValue: kmExport },
    {
      key: 'excess',
      labelKey: 'reportLeaseExcess',
      format: (value) => (value ? km(value) : '—'),
      exportValue: kmExport,
    },
    {
      key: 'excessCost',
      labelKey: 'reportLeaseExcessCost',
      format: (value) => (value == null ? '—' : money(value)),
      exportValue: (value) => (value == null ? '' : value),
    },
  ];

  return (
    <FleetTableReport
      reportKey="lease"
      titleKey="reportLease"
      columns={columns}
      compared={['distance']}
      totals={{ distance: 'sum', allowance: 'sum', excess: 'sum', excessCost: 'sum' }}
      load={load}
    />
  );
};

export default LeaseReportPage;
