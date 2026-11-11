import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Button, Chip } from '@mui/material';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { formatTime } from '../common/util/formatter';
import { useFleetPermission } from '../common/fleet/useFleet';
import { isOpenStatus } from '../common/fleet/workOrders';
import FleetListPage from './components/FleetListPage';
import { money } from './fleetData';
import { pascalCase } from '../common/util/stringUtils';

export const workOrderStatusKey = (status) => `fleetWorkOrderStatus${pascalCase(status)}`;
export const workOrderTypeKey = (type) => `fleetWorkOrderType${pascalCase(type)}`;

const statusColor = {
  planned: 'default',
  open: 'info',
  in_shop: 'warning',
  done: 'success',
  cancelled: 'default',
};

export const WorkOrderStatusChip = ({ status }) => {
  const t = useTranslation();
  return (
    <Chip
      size="small"
      color={statusColor[status]}
      variant={status === 'planned' || status === 'cancelled' ? 'outlined' : 'filled'}
      label={t(workOrderStatusKey(status))}
    />
  );
};

// Work orders across the fleet, open ones first.
const WorkOrdersPage = () => {
  const t = useTranslation();
  const canWrite = useFleetPermission('maintenance.write');
  const [searchParams] = useSearchParams();
  const vehicleFilter = searchParams.get('vehicle');

  return (
    <FleetListPage
      title="fleetWorkOrdersPage"
      description="fleetWorkOrdersPageDescription"
      permission="maintenance.read"
      table="work_orders"
      queryParts={[vehicleFilter]}
      // !inner turns the vehicle embed into a join, so filtering by it drops other vehicles.
      query={(client) => {
        const query = client
          .from('work_orders')
          .select(
            `*, vendors(name), vehicles${vehicleFilter ? '!inner' : ''}(plate_number, traccar_device_id)`,
          )
          .order('opened_at', { ascending: false });
        return vehicleFilter
          ? query.eq('vehicles.traccar_device_id', Number(vehicleFilter))
          : query;
      }}
      filters={[
        { key: 'open', test: (row) => isOpenStatus(row.status) },
        { key: 'done', test: (row) => row.status === 'done' },
        { key: 'all' },
      ].map((item) => ({ ...item, label: t(`fleetWorkOrderFilter${pascalCase(item.key)}`) }))}
      searchOf={(row) => [row.title, row.vehicles?.plate_number, row.vendors?.name, row.number]}
      columns={[
        { key: 'number', label: t('fleetWorkOrderNumber'), nowrap: true },
        {
          key: 'vehicle',
          label: t('fleetEntityVehicle'),
          ltr: true,
          value: (row) => row.vehicles?.plate_number,
        },
        {
          key: 'title',
          label: t('fleetWorkOrderTitle'),
          render: (row) => `${row.title} · ${t(workOrderTypeKey(row.type))}`,
        },
        {
          key: 'type',
          label: t('sharedType'),
          table: false,
          value: (row) => t(workOrderTypeKey(row.type)),
        },
        { key: 'vendor', label: t('fleetVendor'), value: (row) => row.vendors?.name },
        {
          key: 'status',
          label: t('deviceStatus'),
          table: false,
          value: (row) => t(workOrderStatusKey(row.status)),
        },
        {
          key: 'opened_at',
          label: t('fleetWorkOrderOpened'),
          nowrap: true,
          value: (row) => formatTime(row.opened_at, 'date'),
        },
        {
          key: 'closed_at',
          label: t('fleetWorkOrderClosed'),
          table: false,
          value: (row) => formatTime(row.closed_at, 'date'),
        },
        {
          key: 'statusChip',
          label: t('deviceStatus'),
          export: false,
          sortValue: (row) => row.status,
          render: (row) => <WorkOrderStatusChip status={row.status} />,
        },
        {
          key: 'total_cost',
          label: t('fleetCost'),
          nowrap: true,
          value: (row) => Number(row.total_cost),
          render: (row) => money(row.total_cost),
        },
      ]}
      rowLink={(row) => `/fleet/work-order/${row.id}`}
      actions={
        <>
          <Button size="small" component={RouterLink} to="/fleet/vendors">
            {t('fleetVendorsPage')}
          </Button>
        </>
      }
      add={canWrite ? { label: t('fleetWorkOrderAdd'), to: '/fleet/work-order' } : undefined}
      emptyState={{
        icon: <HandymanRoundedIcon />,
        title: t('fleetWorkOrdersNone'),
        description: t('fleetWorkOrdersNoneDescription'),
      }}
      exportFile="work-orders.xlsx"
    />
  );
};

export default WorkOrdersPage;
