import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
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
import { useCatch } from '../reactHelper';
import readSheet from '../common/util/readSheet';
import fetchOrThrow from '../common/util/fetchOrThrow';
import exportExcel from '../common/util/exportExcel';
import { formatTime } from '../common/util/formatter';
import { guessColumns, parseDate, parseNumber } from '../common/fleet/fuelImport';
import { TOLL_HINTS, chargesByDriver, matchCharges, toCharges } from '../common/fleet/tolls';
import { money } from '../fleet/fleetData';

const STATUS_COLOR = { matched: 'success', noTrip: 'warning', unknownPlate: 'default' };

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
      setRows(matchCharges(charges, trips, vehicles));
    } finally {
      setLoading(false);
    }
  });

  const driverName = (key) =>
    key === 'unknown' ? t('tollsUnknownDriver') : drivers[key]?.name || key;
  const totals = rows ? chargesByDriver(rows) : [];

  const onExport = async () => {
    const sheet = rows.map((row) => ({
      [t('tollsTime')]: formatTime(row.time, 'minutes'),
      [t('reportPlate')]: row.plate,
      [t('tollsOperator')]: row.operator || '',
      [t('tollsAmount')]: row.amount,
      [t('sharedDriver')]: row.driver ? driverName(row.driver) : '',
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
        {totals.length > 0 && (
          <Stack
            direction="row"
            flexWrap="wrap"
            gap={1}
            role="status"
            aria-label={t('tollsByDriver')}
          >
            {totals.map((row) => (
              <Chip
                key={row.driver}
                label={
                  <>
                    <bdi>{driverName(row.driver)}</bdi>
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
          <TableToolbar count={rows?.length || 0} exportHandler={rows ? onExport : undefined} />
        }
        empty={!rows}
        emptyState={{ icon: <TollRoundedIcon />, title: t('tollsEmpty') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('tollsTime')}</TableCell>
            <TableCell>{t('reportPlate')}</TableCell>
            <TableCell>{t('tollsOperator')}</TableCell>
            <TableCell>{t('tollsAmount')}</TableCell>
            <TableCell>{t('sharedDriver')}</TableCell>
            <TableCell>{t('deviceStatus')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(rows || []).map((row, index) => (
            <TableRow key={index} hover>
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
              <TableCell>
                <Chip
                  size="small"
                  color={STATUS_COLOR[row.status]}
                  label={t(`tollsStatus${row.status[0].toUpperCase()}${row.status.slice(1)}`)}
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
