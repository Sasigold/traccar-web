import { Link as RouterLink } from 'react-router-dom';
import { Button, Chip } from '@mui/material';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { formatTime } from '../common/util/formatter';
import { useFleetPermission } from '../common/fleet/useFleet';
import FleetListPage from './components/FleetListPage';
import { money } from './fleetData';
import { pascalCase } from '../common/util/stringUtils';

// An empty value (an incident whose fault is not set yet) has no key, instead of breaking the list.
export const incidentKey = (group, value) => `fleetIncident${group}${pascalCase(value)}`;

const statusColor = {
  reported: 'error',
  under_review: 'warning',
  in_repair: 'info',
  claim: 'info',
  closed: 'success',
};

export const IncidentStatusChip = ({ status }) => {
  const t = useTranslation();
  return <Chip size="small" color={statusColor[status]} label={t(incidentKey('Status', status))} />;
};

// Roadmap stage 2: damage and accident reports, newest first.
const IncidentsPage = () => {
  const t = useTranslation();
  const canWrite = useFleetPermission('incidents.write');

  return (
    <FleetListPage
      title="fleetIncidentsPage"
      description="fleetIncidentsPageDescription"
      permission="incidents.read"
      table="incidents"
      query={(client) =>
        client
          .from('incidents')
          .select('*, vehicles(plate_number), drivers(full_name)')
          .order('occurred_at', { ascending: false })
      }
      filters={[
        { key: 'open', test: (row) => row.status !== 'closed' },
        { key: 'closed', test: (row) => row.status === 'closed' },
        { key: 'all' },
      ].map((item) => ({ ...item, label: t(`fleetIncidentFilter${pascalCase(item.key)}`) }))}
      searchOf={(row) => [
        row.vehicles?.plate_number,
        row.drivers?.full_name,
        row.address,
        row.description,
        row.number,
      ]}
      columns={[
        { key: 'number', label: t('fleetWorkOrderNumber'), nowrap: true },
        {
          key: 'occurred_at',
          label: t('fleetIncidentOccurred'),
          nowrap: true,
          value: (row) => formatTime(row.occurred_at, 'minutes'),
        },
        {
          key: 'vehicle',
          label: t('fleetEntityVehicle'),
          ltr: true,
          value: (row) => row.vehicles?.plate_number,
        },
        { key: 'driver', label: t('sharedDriver'), value: (row) => row.drivers?.full_name },
        {
          key: 'type',
          label: t('sharedType'),
          value: (row) => t(incidentKey('Type', row.type)),
          render: (row) => (
            <>
              {t(incidentKey('Type', row.type))}
              {row.injuries && ` · ${t('fleetIncidentInjuries')}`}
            </>
          ),
        },
        {
          key: 'fault',
          label: t('fleetIncidentFault'),
          value: (row) => (row.fault ? t(incidentKey('Fault', row.fault)) : ''),
          render: (row) => (row.fault ? t(incidentKey('Fault', row.fault)) : '—'),
        },
        {
          key: 'status',
          label: t('deviceStatus'),
          value: (row) => t(incidentKey('Status', row.status)),
          render: (row) => <IncidentStatusChip status={row.status} />,
        },
        {
          key: 'repair_cost',
          label: t('fleetIncidentRepairCost'),
          nowrap: true,
          value: (row) => (row.repair_cost == null ? '' : Number(row.repair_cost)),
          render: (row) => money(row.repair_cost),
        },
      ]}
      rowLink={(row) => `/fleet/incident/${row.id}`}
      actions={
        canWrite && (
          <Button variant="contained" size="small" component={RouterLink} to="/fleet/incident">
            {t('fleetIncidentAdd')}
          </Button>
        )
      }
      emptyState={{ icon: <CarCrashRoundedIcon />, title: t('fleetIncidentsNone') }}
      exportFile="incidents.xlsx"
    />
  );
};

export default IncidentsPage;
