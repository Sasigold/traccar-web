import { useState } from 'react';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { getFleetClient } from '../../common/fleet/client';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { periodStart } from '../../common/fleet/costs';
import { money } from '../fleetData';
import KpiTile from '../../common/components/KpiTile';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: theme.spacing(1.5),
  },
}));

const count = async (query) => {
  const { count: value, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return value || 0;
};

// Roadmap 4.5: what needs attention across the fleet database, each tile a link to its list.
const FleetKpis = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const maintenance = useFleetPermission('maintenance.read');
  const incidents = useFleetPermission('incidents.read');
  const costs = useFleetPermission('costs.read');
  const [values, setValues] = useState({});

  useAsyncTask(async () => {
    const client = getFleetClient();
    const head = { count: 'exact', head: true };
    const result = {};
    if (maintenance) {
      result.workOrders = await count(
        client.from('work_orders').select('id', head).in('status', ['planned', 'open', 'in_shop']),
      );
      result.issues = await count(
        client.from('issues').select('id', head).in('status', ['open', 'in_progress']),
      );
    }
    if (incidents) {
      result.incidents = await count(
        client.from('incidents').select('id', head).neq('status', 'closed'),
      );
    }
    if (costs) {
      const { data, error } = await client
        .from('vehicle_monthly_costs')
        .select('amount')
        .eq('month', periodStart(1));
      if (error) {
        throw new Error(error.message);
      }
      result.monthCost = (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    }
    setValues(result);
  }, [maintenance, incidents, costs]);

  const tiles = [
    maintenance && { key: 'workOrders', label: 'fleetKpiOpenWorkOrders', to: '/fleet/work-orders' },
    maintenance && { key: 'issues', label: 'fleetKpiOpenIssues', to: '/fleet/inspections' },
    incidents && { key: 'incidents', label: 'fleetKpiOpenIncidents', to: '/fleet/incidents' },
    costs && { key: 'monthCost', label: 'fleetKpiMonthCost', to: '/fleet/costs', format: money },
  ].filter(Boolean);

  if (!tiles.length) {
    return null;
  }

  return (
    <div className={classes.grid}>
      {tiles.map((tile) => {
        const value = values[tile.key];
        return (
          <KpiTile
            key={tile.key}
            size="md"
            to={tile.to}
            label={t(tile.label)}
            value={value != null && tile.format ? tile.format(value) : value}
          />
        );
      })}
    </div>
  );
};

export default FleetKpis;
