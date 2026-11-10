import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Chip, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useAsyncTask } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import exportExcel from '../common/util/exportExcel';
import { getFleetClient } from '../common/fleet/client';
import { useFleetPermission } from '../common/fleet/useFleet';
import { isOpenStatus } from '../common/fleet/workOrders';
import FleetNotice from './components/FleetNotice';
import { money } from './fleetData';
import { readAllRows } from '../common/data/fleetQuery';
import { pascalCase } from '../common/util/stringUtils';

const useStyles = makeStyles()(() => ({
  row: {
    cursor: 'pointer',
  },
  nowrap: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
}));

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

const filters = ['open', 'done', 'all'];

// Roadmap stage 2: work orders across the fleet, open ones first.
const WorkOrdersPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const navigate = useNavigate();
  const canRead = useFleetPermission('maintenance.read');
  const canWrite = useFleetPermission('maintenance.write');

  const [searchParams] = useSearchParams();
  const vehicleFilter = searchParams.get('vehicle');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);

  useAsyncTask(async () => {
    if (!canRead) {
      return;
    }
    // !inner turns the vehicle embed into a join, so filtering by it drops other vehicles.
    // ARC-08: every page, not the first 500.
    const build = () => {
      const query = getFleetClient()
        .from('work_orders')
        .select(
          `*, vendors(name), vehicles${vehicleFilter ? '!inner' : ''}(plate_number, traccar_device_id)`,
        )
        .order('opened_at', { ascending: false });
      return vehicleFilter ? query.eq('vehicles.traccar_device_id', Number(vehicleFilter)) : query;
    };
    setRows(await readAllRows('work_orders', build));
  }, [canRead, vehicleFilter]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (rows || []).filter((row) => {
      if (filter === 'open' && !isOpenStatus(row.status)) {
        return false;
      }
      if (filter === 'done' && row.status !== 'done') {
        return false;
      }
      return (
        !keyword ||
        [row.title, row.vehicles?.plate_number, row.vendors?.name, String(row.number)].some(
          (value) => value?.toLowerCase().includes(keyword),
        )
      );
    });
  }, [rows, filter, search]);

  const handleExport = async () => {
    const data = filtered.map((row) => ({
      [t('fleetWorkOrderNumber')]: row.number,
      [t('fleetEntityVehicle')]: row.vehicles?.plate_number,
      [t('fleetWorkOrderTitle')]: row.title,
      [t('sharedType')]: t(workOrderTypeKey(row.type)),
      [t('fleetVendor')]: row.vendors?.name,
      [t('deviceStatus')]: t(workOrderStatusKey(row.status)),
      [t('fleetWorkOrderOpened')]: formatTime(row.opened_at, 'date'),
      [t('fleetWorkOrderClosed')]: formatTime(row.closed_at, 'date'),
      [t('fleetCost')]: Number(row.total_cost),
    }));
    const sheets = new Map();
    sheets.set(t('fleetWorkOrdersPage'), data);
    await exportExcel(t('fleetWorkOrdersPage'), 'work-orders.xlsx', sheets, theme);
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetWorkOrdersPage']}
      description={t('fleetWorkOrdersPageDescription')}
    >
      <FleetNotice permission="maintenance.read" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows ? filtered.length : undefined}
            exportHandler={handleExport}
            filters={filters.map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(`fleetWorkOrderFilter${pascalCase(key)}`)}
                color={filter === key ? 'primary' : 'default'}
                variant={filter === key ? 'filled' : 'outlined'}
                onClick={() => setFilter(key)}
              />
            ))}
            actions={
              <>
                <Button size="small" component={RouterLink} to="/fleet/vendors">
                  {t('fleetVendorsPage')}
                </Button>
                {canWrite && (
                  <Button
                    variant="contained"
                    size="small"
                    component={RouterLink}
                    to="/fleet/work-order"
                  >
                    {t('fleetWorkOrderAdd')}
                  </Button>
                )}
              </>
            }
          />
        }
        empty={rows != null && filtered.length === 0}
        emptyState={{
          icon: <HandymanRoundedIcon />,
          title: t(search ? 'tableNoMatches' : 'fleetWorkOrdersNone'),
          description: search ? undefined : t('fleetWorkOrdersNoneDescription'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetWorkOrderNumber')}</TableCell>
            <TableCell>{t('fleetEntityVehicle')}</TableCell>
            <TableCell>{t('fleetWorkOrderTitle')}</TableCell>
            <TableCell>{t('fleetVendor')}</TableCell>
            <TableCell>{t('fleetWorkOrderOpened')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell>{t('fleetCost')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows == null && canRead && <TableShimmer columns={7} />}
          {filtered.map((row) => (
            <TableRow
              key={row.id}
              hover
              tabIndex={0}
              className={classes.row}
              onClick={() => navigate(`/fleet/work-order/${row.id}`)}
              onKeyDown={(event) =>
                event.key === 'Enter' && navigate(`/fleet/work-order/${row.id}`)
              }
            >
              <TableCell className={classes.nowrap}>{row.number}</TableCell>
              <TableCell>
                <span dir="ltr">{row.vehicles?.plate_number}</span>
              </TableCell>
              <TableCell>
                {row.title}
                {` · ${t(workOrderTypeKey(row.type))}`}
              </TableCell>
              <TableCell>{row.vendors?.name}</TableCell>
              <TableCell className={classes.nowrap}>{formatTime(row.opened_at, 'date')}</TableCell>
              <TableCell>
                <WorkOrderStatusChip status={row.status} />
              </TableCell>
              <TableCell className={classes.nowrap}>{money(row.total_cost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default WorkOrdersPage;
