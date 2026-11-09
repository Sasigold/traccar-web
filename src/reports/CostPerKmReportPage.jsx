import { useCallback } from 'react';
import { Alert } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance } from '../common/util/formatter';
import { useFleetPermission } from '../common/fleet/useFleet';
import { loadCosts } from '../dashboard/data/fleetSources';
import { money } from '../fleet/fleetData';
import FleetTableReport from './components/FleetTableReport';
import { costPerKmByVehicle } from './common/fleetReports';
import { loadReportRows } from './UsageReportPage';

const monthsSince = (from) => {
  const start = new Date(from);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth() + 1;
};

// /reports/cost-per-km (REP-23): what each kilometer cost, from the fleet database's fuel,
// maintenance and other costs over Traccar's distance, by calendar month.
const CostPerKmReportPage = () => {
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  const canCosts = useFleetPermission('costs.read');

  const load = useCallback(
    async (scope) => {
      const [summary, costs] = await Promise.all([
        loadReportRows('summary', scope),
        canCosts ? loadCosts(Math.max(1, monthsSince(scope.from))) : [],
      ]);
      const first = scope.from.slice(0, 7);
      const last = scope.to.slice(0, 7);
      const inPeriod = costs.filter((row) => {
        const month = String(row.month).slice(0, 7);
        return month >= first && month <= last;
      });
      return costPerKmByVehicle(scope.devices, summary, inPeriod);
    },
    [canCosts],
  );

  const shekel = (v) => (v ? money(v) : '—');
  const columns = [
    {
      key: 'distance',
      labelKey: 'sharedDistance',
      format: (v) => formatDistance(v, distanceUnit, t),
      exportValue: (v) => v / 1000,
    },
    { key: 'fuel', labelKey: 'fleetCostFuel', format: shekel },
    { key: 'maintenance', labelKey: 'fleetCostMaintenance', format: shekel },
    { key: 'other', labelKey: 'fleetCostOther', format: shekel },
    { key: 'total', labelKey: 'costPerKmTotal', format: shekel },
    {
      key: 'perKm',
      labelKey: 'costPerKm',
      format: (v) => (v == null ? '—' : money(v)),
      exportValue: (v) => (v == null ? '' : Math.round(v * 100) / 100),
    },
  ];

  return (
    <FleetTableReport
      reportKey="costPerKm"
      titleKey="reportCostPerKm"
      columns={columns}
      totals={{ distance: 'sum', fuel: 'sum', maintenance: 'sum', other: 'sum', total: 'sum' }}
      load={load}
      filterChildren={!canCosts && <Alert severity="info">{t('costPerKmNoCosts')}</Alert>}
    />
  );
};

export default CostPerKmReportPage;
