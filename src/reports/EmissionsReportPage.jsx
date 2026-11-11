import { useCallback } from 'react';
import { Alert } from '@mui/material';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance } from '../common/util/formatter';
import { useFleetPermission, useFleetStatus } from '../common/fleet/useFleet';
import { getFleetClient } from '../common/fleet/client';
import { readAllRows } from '../common/data/fleetQuery';
import FleetTableReport from './components/FleetTableReport';
import useReportStyles from './common/useReportStyles';
import { emissionsByMonth, emissionsByVehicle } from './common/emissions';
import { loadReportRows } from './UsageReportPage';

// The fleet database's fuel liters and fuel types, keyed by Traccar device.
const loadFuel = async (from, to) => {
  const client = getFleetClient();
  // Every page of both (PostgREST returns 1,000 rows at a time), in a fixed order.
  const [vehicles, fuel] = await Promise.all([
    readAllRows('vehicles', () =>
      client.from('vehicles').select('id, traccar_device_id, fuel_type').order('id'),
    ),
    readAllRows('fuel_transactions', () =>
      client
        .from('fuel_transactions')
        .select('id, vehicle_id, liters, fuel_type, occurred_at')
        .gte('occurred_at', from)
        .lte('occurred_at', to)
        .order('occurred_at')
        .order('id'),
    ),
  ]);
  const deviceOf = Object.fromEntries((vehicles || []).map((v) => [v.id, v.traccar_device_id]));
  const fuelTypes = Object.fromEntries(
    (vehicles || [])
      .filter((v) => v.traccar_device_id && v.fuel_type)
      .map((v) => [v.traccar_device_id, v.fuel_type]),
  );
  const rows = (fuel || []).map((row) => ({ ...row, deviceId: deviceOf[row.vehicle_id] ?? null }));
  return { fuel: rows, fuelTypes };
};

const kg = (value) => (value ? Math.round(value).toLocaleString() : '0');

// /reports/emissions (OPS-10): tailpipe CO2 per vehicle for ESG reports and tenders, from the
// fuel imports when there are liters, otherwise estimated from kilometers and fuel type.
const EmissionsReportPage = () => {
  const { classes } = useReportStyles();
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  const fleetReady = useFleetStatus() === 'ready';
  const canCosts = useFleetPermission('costs.read');

  const load = useCallback(
    async (scope) => {
      const [summary, { fuel, fuelTypes }] = await Promise.all([
        loadReportRows('summary', scope),
        fleetReady && canCosts ? loadFuel(scope.from, scope.to) : { fuel: [], fuelTypes: {} },
      ]);
      const ids = new Set(scope.devices.map((device) => device.id));
      const own = fuel.filter((row) => ids.has(row.deviceId));
      const rows = emissionsByVehicle(scope.devices, summary, own, fuelTypes);
      rows.months = emissionsByMonth(own, fuelTypes);
      return rows;
    },
    [fleetReady, canCosts],
  );

  const columns = [
    {
      key: 'fuelType',
      labelKey: 'emissionsFuelType',
      format: (v) => (v ? t(`emissionsFuel_${v}`) : '—'),
    },
    {
      key: 'distance',
      labelKey: 'sharedDistance',
      format: (v) => formatDistance(v, distanceUnit, t),
      exportValue: (v) => Math.round(v / 100) / 10,
    },
    {
      key: 'liters',
      labelKey: 'emissionsLiters',
      format: (v) => (v ? Math.round(v).toLocaleString() : '—'),
    },
    {
      key: 'co2',
      labelKey: 'emissionsCo2',
      format: kg,
      exportValue: (v) => Math.round(v * 10) / 10,
    },
    {
      key: 'perKm',
      labelKey: 'emissionsPerKm',
      format: (v) => (v == null ? '—' : Math.round(v)),
      exportValue: (v) => (v == null ? '' : Math.round(v)),
    },
    {
      key: 'method',
      labelKey: 'emissionsMethod',
      format: (v) => (v ? t(`emissionsMethod_${v}`) : '—'),
    },
  ];

  return (
    <FleetTableReport
      reportKey="emissions"
      titleKey="reportEmissions"
      columns={columns}
      compared={['distance', 'liters', 'co2']}
      totals={{ distance: 'sum', liters: 'sum', co2: 'sum' }}
      load={load}
      filterChildren={
        !(fleetReady && canCosts) && <Alert severity="info">{t('emissionsNoFuel')}</Alert>
      }
      summary={(items) =>
        items.months?.length > 0 && (
          <Alert severity="info" className={classes.recommendation}>
            {t('emissionsByMonth')}{' '}
            {items.months.map(({ month, co2 }) => `${month}: ${kg(co2)}`).join(' · ')}
          </Alert>
        )
      }
    />
  );
};

export default EmissionsReportPage;
