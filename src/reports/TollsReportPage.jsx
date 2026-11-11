import { useReducer, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import TollRoundedIcon from '@mui/icons-material/TollRounded';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import ReportsMenu from './components/ReportsMenu';
import { useAsyncTask, useCatch } from '../reactHelper';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile, useFleetStatus } from '../common/fleet/useFleet';
import readSheet from '../common/util/readSheet';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { formatTime } from '../common/util/formatter';
import { guessColumns, parseDate, parseNumber } from '../common/fleet/fuelImport';
import { TOLL_HINTS, chargeTotals, matchCharges, toCharges } from '../common/fleet/tolls';
import { money } from '../fleet/fleetData';

const STATUS_COLOR = { matched: 'success', noTrip: 'warning', unknownPlate: 'default' };
const SAVED_DAYS = 92;
const digits = (value) => String(value ?? '').replace(/\D/g, '');

// A saved charge (toll_charges) as a row of the table.
const fromSaved = (row) => ({
  id: row.id,
  time: row.charged_at,
  plate: row.plate,
  amount: Number(row.amount),
  operator: row.operator,
  place: row.place,
  driver: row.driver_unique_id,
  status: row.status,
  private: row.private,
  costCenter: row.cost_center,
  deviceId: row.traccar_device_id,
});

// /reports/tolls (ISR-06): Road 6, the Carmel tunnels, the fast lane and parking charges from a
// monthly statement, matched to the trip and the driver. There is no public API for fleets, so
// the statement comes as a file (CSV or Excel).
const TollsReportPage = () => {
  const t = useTranslation();
  const theme = useTheme();
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  // ISR-06: statements are kept in the fleet database (toll_charges), when it is there.
  const fleetReady = useFleetStatus() === 'ready';
  const canRead = useFleetPermission('costs.read');
  const canWrite = useFleetPermission('costs.write');
  const profile = useFleetProfile();
  const [saved, setSaved] = useState(null);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [statement, setStatement] = useState('');
  const [saving, setSaving] = useState(false);
  const [reloadKey, reloadSaved] = useReducer((key) => key + 1, 0);

  useAsyncTask(async () => {
    void reloadKey;
    if (!fleetReady || !(canRead || canWrite)) return;
    const client = getFleetClient();
    const since = new Date(Date.now() - SAVED_DAYS * 86400000).toISOString();
    const [charges, vehicleRows] = await Promise.all([
      client
        .from('toll_charges')
        .select('*')
        .gte('charged_at', since)
        .order('charged_at', { ascending: false })
        .limit(5000),
      client.from('vehicles').select('id, plate_number, cost_center, traccar_device_id'),
    ]);
    setFleetVehicles(vehicleRows.data || []);
    // Without the migration the page works as before: in memory only.
    setSaved(charges.error ? null : (charges.data || []).map(fromSaved));
  }, [fleetReady, canRead, canWrite, reloadKey]);

  const vehicleByPlate = new Map(fleetVehicles.map((row) => [digits(row.plate_number), row]));

  const vehicles = Object.values(devices)
    .filter((device) => device.attributes?.plateNumber)
    .map((device) => ({ deviceId: device.id, plate: device.attributes.plateNumber }));

  const load = useCatch(async (file) => {
    setProblem(null);
    setLoading(true);
    try {
      const sheet = await readSheet(file);
      const [headers, ...body] = sheet;
      const mapping = guessColumns((headers || []).map(String), TOLL_HINTS);
      if (mapping.time == null || mapping.plate == null || mapping.amount == null) {
        setProblem(t('tollsColumnsMissing'));
        setRows(null);
        return;
      }
      const charges = toCharges(body, mapping, parseDate, parseNumber).map((charge) => ({
        ...charge,
        time: charge.time.toISOString(),
      }));
      if (!charges.length) {
        setProblem(t('tollsNoRows'));
        setRows(null);
        return;
      }
      // The trips of the statement's period, for the vehicles it names.
      const times = charges.map((charge) => Date.parse(charge.time));
      const query = new URLSearchParams({
        from: new Date(Math.min(...times) - 3600000).toISOString(),
        to: new Date(Math.max(...times) + 3600000).toISOString(),
      });
      vehicles.forEach((vehicle) => query.append('deviceId', vehicle.deviceId));
      const trips = vehicles.length
        ? await (
            await fetchOrThrow(`api/reports/trips?${query}`, {
              headers: { Accept: 'application/json' },
            })
          ).json()
        : [];
      setRows(
        matchCharges(charges, trips, vehicles).map((row) => ({
          ...row,
          private: false,
          costCenter: vehicleByPlate.get(digits(row.plate))?.cost_center || null,
        })),
      );
      setStatement(file.name);
    } finally {
      setLoading(false);
    }
  });

  const driverName = (key) =>
    key === 'unknown' || !key
      ? t('tollsUnknownDriver')
      : Object.values(drivers).find((driver) => driver.uniqueId === key)?.name ||
        drivers[key]?.name ||
        key;
  // What the table shows: a statement just loaded, else the saved ones.
  const shown = rows || saved;
  const totals = shown ? chargeTotals(shown) : null;

  const saveStatement = useCatch(async () => {
    setSaving(true);
    try {
      const payload = rows.map((row) => ({
        org_id: profile.org_id,
        vehicle_id: vehicleByPlate.get(digits(row.plate))?.id || null,
        traccar_device_id: row.deviceId,
        plate: String(row.plate).trim(),
        charged_at: row.time,
        amount: row.amount,
        operator: row.operator ? String(row.operator).slice(0, 100) : null,
        place: row.place ? String(row.place).slice(0, 200) : null,
        driver_unique_id: row.driver,
        status: row.status,
        private: Boolean(row.private),
        cost_center: row.costCenter,
        statement: statement.slice(0, 200) || null,
      }));
      unwrap(
        await getFleetClient().from('toll_charges').upsert(payload, {
          onConflict: 'org_id,plate,charged_at,amount',
          ignoreDuplicates: true,
        }),
      );
      setRows(null);
      reloadSaved();
    } finally {
      setSaving(false);
    }
  });

  const togglePrivate = useCatch(async (row, index) => {
    const value = !row.private;
    if (row.id) {
      unwrap(
        await getFleetClient()
          .from('toll_charges')
          .update({ private: value, updated_at: new Date().toISOString() })
          .eq('id', row.id),
      );
      setSaved((list) =>
        list.map((item) => (item.id === row.id ? { ...item, private: value } : item)),
      );
    } else {
      setRows((list) => list.map((item, i) => (i === index ? { ...item, private: value } : item)));
    }
  });

  const onExport = async () => {
    const sheet = shown.map((row) => ({
      [t('tollsTime')]: formatTime(row.time, 'minutes'),
      [t('reportPlate')]: row.plate,
      [t('tollsOperator')]: row.operator || '',
      [t('tollsAmount')]: row.amount,
      [t('sharedDriver')]: row.driver ? driverName(row.driver) : '',
      [t('tollsCostCenter')]: row.costCenter || '',
      [t('tollsPrivate')]: row.private ? t('sharedYes') : '',
      [t('deviceStatus')]: t(`tollsStatus${row.status[0].toUpperCase()}${row.status.slice(1)}`),
    }));
    await exportExcel(t('reportTolls'), 'tolls.xlsx', new Map([[t('reportTolls'), sheet]]), theme);
  };

  return (
    <PageLayout
      menu={<ReportsMenu />}
      breadcrumbs={['reportTitle', 'reportTolls']}
      description={t('reportTollsDescription')}
    >
      <Stack spacing={2} sx={{ mx: 3, mb: 2 }}>
        <div>
          <Button
            variant="contained"
            startIcon={<UploadFileRoundedIcon />}
            onClick={() => fileRef.current?.click()}
            loading={loading}
          >
            {t('tollsLoad')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx"
            hidden
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const [file] = event.target.files;
              event.target.value = '';
              if (file) load(file);
            }}
          />
        </div>
        {problem && <Alert severity="warning">{problem}</Alert>}
        {rows && saved && canWrite && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" onClick={saveStatement} loading={saving}>
                {t('tollsSave')}
              </Button>
            }
          >
            {t('tollsUnsaved').replace('{0}', String(rows.length))}
          </Alert>
        )}
        {rows && saved && (
          <div>
            <Button size="small" onClick={() => setRows(null)}>
              {t('tollsShowSaved')}
            </Button>
          </div>
        )}
        {totals && totals.byDriver.length > 0 && (
          <Stack
            direction="row"
            sx={{ flexWrap: 'wrap', gap: 1 }}
            role="status"
            aria-label={t('tollsByDriver')}
          >
            {totals.byDriver.map((row) => (
              <Chip
                key={row.driver}
                label={
                  <>
                    <bdi>{driverName(row.driver)}</bdi>
                    {' · '}
                    <bdi>{money(row.amount)}</bdi>
                    {row.private > 0 && (
                      <>
                        {' · '}
                        <bdi>{t('tollsPrivateAmount').replace('{0}', money(row.private))}</bdi>
                      </>
                    )}
                  </>
                }
              />
            ))}
          </Stack>
        )}
        {totals && totals.byCostCenter.some((row) => row.costCenter) && (
          <Stack
            direction="row"
            sx={{ flexWrap: 'wrap', gap: 1 }}
            role="status"
            aria-label={t('tollsByCostCenter')}
          >
            {totals.byCostCenter.map((row) => (
              <Chip
                key={row.costCenter || '-'}
                variant="outlined"
                label={
                  <>
                    <bdi>{row.costCenter || t('tollsNoCostCenter')}</bdi>
                    {' · '}
                    <bdi>{money(row.amount)}</bdi>
                  </>
                }
              />
            ))}
          </Stack>
        )}
      </Stack>
      <DataTable
        toolbar={
          <TableToolbar
            count={shown?.length || 0}
            exportHandler={shown?.length ? onExport : undefined}
          />
        }
        empty={!shown?.length}
        emptyState={{ icon: <TollRoundedIcon />, title: t('tollsEmpty') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('tollsTime')}</TableCell>
            <TableCell>{t('reportPlate')}</TableCell>
            <TableCell>{t('tollsOperator')}</TableCell>
            <TableCell>{t('tollsAmount')}</TableCell>
            <TableCell>{t('sharedDriver')}</TableCell>
            <TableCell>{t('tollsCostCenter')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
            <TableCell padding="checkbox">{t('tollsPrivate')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(shown || []).map((row, index) => (
            <TableRow key={row.id || index} hover>
              <TableCell>{formatTime(row.time, 'minutes')}</TableCell>
              <TableCell>
                <span dir="ltr">{row.plate}</span>
              </TableCell>
              <TableCell>
                {row.operator || row.place || '—'}
                {row.operator && row.place && (
                  <Typography variant="caption" display="block" color="textSecondary">
                    {row.place}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{money(row.amount)}</TableCell>
              <TableCell>{row.driver ? driverName(row.driver) : '—'}</TableCell>
              <TableCell>{row.costCenter || '—'}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  color={STATUS_COLOR[row.status]}
                  label={t(`tollsStatus${row.status[0].toUpperCase()}${row.status.slice(1)}`)}
                />
              </TableCell>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={Boolean(row.private)}
                  disabled={!canWrite && Boolean(row.id)}
                  onChange={() => togglePrivate(row, index)}
                  slotProps={{
                    input: {
                      'aria-label': `${t('tollsPrivate')}: ${row.plate} ${formatTime(row.time, 'minutes')}`,
                    },
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
    </PageLayout>
  );
};

export default TollsReportPage;
