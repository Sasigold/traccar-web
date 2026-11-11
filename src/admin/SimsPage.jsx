import { useMemo, useReducer, useState } from 'react';
import {
  Alert,
  Chip,
  MenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import SimCardRoundedIcon from '@mui/icons-material/SimCardRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import TableShimmer from '../common/components/TableShimmer';
import FileInput from '../common/components/FileInput';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import { useAdminAccess, useTraccarList } from './useAdmin';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import readSheet from '../common/util/readSheet';
import { parseSims } from './simImport';
import { capitalize } from '../common/util/stringUtils';

const STATUSES = ['stock', 'active', 'suspended', 'cancelled'];
const statusColor = {
  stock: 'default',
  active: 'success',
  suspended: 'warning',
  cancelled: 'default',
};

// BIZ-05: the service's SIM cards: imported from the carrier's list, put in a device (then
// active), suspended or cancelled. Which device has which SIM, and which SIMs wait in stock.
const SimsPage = () => {
  const t = useTranslation();
  const access = useAdminAccess();
  const [devices] = useTraccarList('api/devices?all=true');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [imported, setImported] = useState(null);

  useAsyncTask(async () => {
    void reloadKey;
    if (!access.customersRead) return;
    setRows(unwrap(await getFleetClient().from('sim_cards').select('*').order('iccid')) || []);
  }, [access.customersRead, reloadKey]);

  const deviceName = useMemo(
    () => new Map((devices || []).map((device) => [device.id, device.name])),
    [devices],
  );
  const filtered = (rows || []).filter(
    (row) =>
      (filter === 'all' || row.status === filter) &&
      (!search.trim() ||
        [row.iccid, row.msisdn, row.carrier, deviceName.get(row.traccar_device_id)].some((value) =>
          String(value ?? '').includes(search.trim()),
        )),
  );

  const importFile = useCatch(async (file) => {
    if (!file) return;
    const { sims, skipped } = parseSims(await readSheet(file));
    // A SIM already listed keeps its device and state; its number and carrier are updated.
    for (let i = 0; i < sims.length; i += 500) {
      unwrap(
        await getFleetClient()
          .from('sim_cards')
          .upsert(sims.slice(i, i + 500), { onConflict: 'iccid' }),
      );
    }
    setImported({ count: sims.length, skipped });
    reload();
  });

  const update = useCatch(async (row, changes) => {
    unwrap(await getFleetClient().from('sim_cards').update(changes).eq('iccid', row.iccid));
    reload();
  });

  const manage = access.customersManage;

  return (
    <PageLayout
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminSims']}
      description={t('adminSimsDescription')}
    >
      <AdminGate need="customersRead" />
      {imported && (
        <Alert severity="success" onClose={() => setImported(null)} sx={{ mx: 3, mb: 1 }}>
          {t('adminSimsImported')
            .replace('{0}', String(imported.count))
            .replace('{1}', String(imported.skipped))}
        </Alert>
      )}
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows ? filtered.length : undefined}
            filters={['all', ...STATUSES].map((key) => (
              <Chip
                key={key}
                size="small"
                label={t(key === 'all' ? 'fleetFilterAll' : `adminSimStatus${capitalize(key)}`)}
                color={filter === key ? 'primary' : 'default'}
                variant={filter === key ? 'filled' : 'outlined'}
                onClick={() => setFilter(key)}
              />
            ))}
            actions={
              manage && (
                <FileInput
                  placeholder={t('adminSimsImport')}
                  value={null}
                  onChange={importFile}
                  slotProps={{ htmlInput: { accept: '.csv,.xlsx,text/csv' } }}
                />
              )
            }
          />
        }
        empty={rows != null && filtered.length === 0}
        emptyState={{
          icon: <SimCardRoundedIcon />,
          title: t('adminSimsNone'),
          description: t('adminSimsNoneDescription'),
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>ICCID</TableCell>
            <TableCell>{t('sharedPhone')}</TableCell>
            <TableCell>{t('adminSimCarrier')}</TableCell>
            <TableCell>{t('adminDevice')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows == null && access.customersRead && <TableShimmer columns={5} />}
          {filtered.map((row) => (
            <TableRow key={row.iccid} hover>
              <TableCell>
                <span dir="ltr">{row.iccid}</span>
              </TableCell>
              <TableCell>
                <span dir="ltr">{row.msisdn}</span>
              </TableCell>
              <TableCell>{row.carrier}</TableCell>
              <TableCell>
                {manage ? (
                  <TextField
                    select
                    size="small"
                    value={row.traccar_device_id ?? ''}
                    onChange={(event) =>
                      update(row, {
                        traccar_device_id:
                          event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                    slotProps={{ htmlInput: { 'aria-label': t('adminDevice') } }}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="">{t('adminSimNoDevice')}</MenuItem>
                    {(devices || []).map((device) => (
                      <MenuItem key={device.id} value={device.id}>
                        {device.name}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  deviceName.get(row.traccar_device_id) || '—'
                )}
              </TableCell>
              <TableCell>
                {manage ? (
                  <TextField
                    select
                    size="small"
                    value={row.status}
                    onChange={(event) => update(row, { status: event.target.value })}
                    slotProps={{ htmlInput: { 'aria-label': t('deviceStatus') } }}
                  >
                    {STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>
                        {t(`adminSimStatus${capitalize(status)}`)}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <Chip
                    size="small"
                    color={statusColor[row.status]}
                    label={t(`adminSimStatus${capitalize(row.status)}`)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default SimsPage;
