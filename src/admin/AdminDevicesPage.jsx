import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Chip,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatch } from '../reactHelper';
import { formatTime } from '../common/util/formatter';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import StateChip from './components/StateChip';
import CustomerSelect from './components/CustomerSelect';
import AssignCustomerDialog from './components/AssignCustomerDialog';
import { useAdminAccess, useAdminDirectory, useTraccarList } from './useAdmin';
import { assignDevices } from './adminApi';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  filters: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  customerFilter: {
    width: 220,
  },
  name: {
    fontWeight: 600,
  },
  sub: {
    display: 'block',
    color: theme.palette.text.secondary,
  },
  row: {
    cursor: 'pointer',
  },
  muted: {
    color: theme.palette.text.secondary,
  },
}));

export const NO_CUSTOMER = 'none';

const AdminDevicesPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const access = useAdminAccess();
  const directory = useAdminDirectory();
  const [devices, reloadDevices] = useTraccarList('api/devices?all=true');

  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);

  const rows = useMemo(() => {
    if (!devices) return null;
    const needle = search.trim().toLowerCase();
    return devices
      .filter((device) => {
        const owner = directory.deviceOwner.get(device.id)?.customer_id ?? null;
        if (customerFilter === NO_CUSTOMER && owner) return false;
        if (customerFilter && customerFilter !== NO_CUSTOMER && owner !== customerFilter)
          return false;
        if (statusFilter !== 'all' && device.status !== statusFilter) return false;
        if (!needle) return true;
        return [device.name, device.uniqueId, device.phone, device.model]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(needle));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, search, customerFilter, statusFilter, directory.deviceOwner]);

  const unassigned = devices
    ? devices.filter((device) => !directory.deviceOwner.get(device.id)?.customer_id).length
    : 0;

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((it) => it !== id) : [...current, id],
    );
  const allSelected = rows?.length > 0 && rows.every((row) => selected.includes(row.id));

  const handleAssign = useCatch(async (customerId) => {
    await assignDevices(selected, customerId);
    setAssignOpen(false);
    setSelected([]);
    directory.reload();
    reloadDevices();
  });

  const customerOptions = [{ id: NO_CUSTOMER, name: t('adminNoCustomer') }, ...directory.customers];

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminDevices']}
      description={t('adminDevicesDescription')}
    >
      <AdminGate need="customersRead" />
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch, placeholder: t('adminDeviceSearch') }}
            count={rows?.length}
            addPath="/admin/device"
            addLabel={t('adminNewDevice')}
            filters={
              <div className={classes.filters}>
                {access.customersRead && (
                  <div className={classes.customerFilter}>
                    <CustomerSelect
                      size="small"
                      label={t('adminCustomer')}
                      customers={customerOptions}
                      value={customerFilter}
                      onChange={setCustomerFilter}
                    />
                  </div>
                )}
                {['all', 'online', 'offline'].map((status) => (
                  <Chip
                    key={status}
                    size="small"
                    clickable
                    label={t(
                      status === 'all'
                        ? 'fleetFilterAll'
                        : `deviceStatus${status.charAt(0).toUpperCase()}${status.slice(1)}`,
                    )}
                    color={statusFilter === status ? 'primary' : 'default'}
                    variant={statusFilter === status ? 'filled' : 'outlined'}
                    onClick={() => setStatusFilter(status)}
                  />
                ))}
                {access.customersRead && unassigned > 0 && (
                  <Chip
                    size="small"
                    clickable
                    color="warning"
                    variant="outlined"
                    label={t('adminUnassignedCount').replace('{0}', unassigned)}
                    onClick={() => setCustomerFilter(NO_CUSTOMER)}
                  />
                )}
              </div>
            }
            actions={
              access.customersManage && selected.length > 0 ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<StoreRoundedIcon />}
                  onClick={() => setAssignOpen(true)}
                >
                  {t('adminAssignSelected').replace('{0}', selected.length)}
                </Button>
              ) : null
            }
          />
        }
        empty={rows?.length === 0}
        emptyState={{
          icon: <DnsRoundedIcon />,
          title: t(search ? 'tableNoMatches' : 'tableEmptyTitle'),
        }}
      >
        <TableHead>
          <TableRow>
            {access.customersManage && (
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={allSelected}
                  indeterminate={selected.length > 0 && !allSelected}
                  onChange={() => setSelected(allSelected ? [] : (rows || []).map((row) => row.id))}
                  slotProps={{ input: { 'aria-label': t('adminSelectAll') } }}
                />
              </TableCell>
            )}
            <TableCell>{t('sharedDevice')}</TableCell>
            <TableCell>{t('adminCustomer')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell>{t('deviceModel')}</TableCell>
            <TableCell>{t('adminSimNumber')}</TableCell>
            <TableCell padding="none" />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows ? (
            rows.map((device) => {
              const registry = directory.deviceOwner.get(device.id);
              const customer = registry?.customer_id
                ? directory.customerById.get(registry.customer_id)
                : null;
              return (
                <TableRow
                  key={device.id}
                  hover
                  className={classes.row}
                  selected={selected.includes(device.id)}
                  onClick={() => navigate(`/admin/device/${device.id}`)}
                >
                  {access.customersManage && (
                    <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        size="small"
                        checked={selected.includes(device.id)}
                        onChange={() => toggle(device.id)}
                        slotProps={{ input: { 'aria-label': device.name } }}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <span className={classes.name}>{device.name}</span>
                    <Typography
                      variant="caption"
                      className={classes.sub}
                      dir="ltr"
                      style={{ textAlign: 'start' }}
                    >
                      {device.uniqueId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {customer ? (
                      customer.name
                    ) : (
                      <span className={classes.muted}>{t('adminNoCustomer')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StateChip
                      state={device.status || 'unknown'}
                      label={t(`deviceStatus${capitalize(device.status || 'unknown')}`)}
                    />
                    {device.lastUpdate && (
                      <Typography
                        variant="caption"
                        className={classes.sub}
                        dir="ltr"
                        style={{ textAlign: 'start' }}
                      >
                        {formatTime(device.lastUpdate, 'minutes')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{registry?.device_model || device.model || ''}</TableCell>
                  <TableCell>
                    <span dir="ltr">{device.phone || ''}</span>
                  </TableCell>
                  <TableCell padding="none">
                    <Tooltip title={t('adminDeviceSetup')}>
                      <IconButton size="small" aria-label={t('adminDeviceSetup')}>
                        <TuneRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableShimmer columns={access.customersManage ? 7 : 6} />
          )}
        </TableBody>
      </DataTable>
      {assignOpen && (
        <AssignCustomerDialog
          open
          title={t('adminAssignSelected').replace('{0}', selected.length)}
          description={t('adminAssignDevicesHelp')}
          customers={directory.customers}
          onClose={() => setAssignOpen(false)}
          onAssign={handleAssign}
        />
      )}
    </PageLayout>
  );
};

export default AdminDevicesPage;
