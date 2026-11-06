import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ButtonBase, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { getFleetClient } from '../../common/fleet/client';
import { useFleetPermission } from '../../common/fleet/useFleet';
import { periodStart } from '../../common/fleet/costs';
import { money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gap: theme.spacing(1.5),
  },
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    textAlign: 'start',
    gap: 2,
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    border: '1px solid transparent',
    backgroundColor: theme.palette.surface.tint,
    '&:hover, &:focus-visible': {
      borderColor: alpha(theme.palette.primary.main, 0.4),
    },
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  value: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.2,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
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
      {tiles.map((tile) => (
        <ButtonBase key={tile.key} component={RouterLink} to={tile.to} className={classes.tile}>
          <span className={classes.label}>{t(tile.label)}</span>
          <Typography component="span" className={classes.value}>
            {values[tile.key] == null
              ? '—'
              : tile.format
                ? tile.format(values[tile.key])
                : values[tile.key]}
          </Typography>
        </ButtonBase>
      ))}
    </div>
  );
};

export default FleetKpis;
