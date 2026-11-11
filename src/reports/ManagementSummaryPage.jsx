import { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import CarCrashRoundedIcon from '@mui/icons-material/CarCrashRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DocumentPrintHeader from '../common/components/print/DocumentPrintHeader';
import KpiTile from '../common/components/KpiTile';
import TableShimmer from '../common/components/TableShimmer';
import usePersistedState from '../common/util/usePersistedState';
import { useAttributePreference } from '../common/util/preferences';
import { formatDistance, formatNumericHours, formatTime } from '../common/util/formatter';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { useFleetPermission } from '../common/fleet/useFleet';
import { getFleetClient } from '../common/fleet/client';
import { loadCosts } from '../dashboard/data/fleetSources';
import { money } from '../fleet/fleetData';
import ReportsMenu from './components/ReportsMenu';
import { changeHint } from './common/previousPeriod';
import {
  eventCounts,
  fleetMonth,
  lastMonth,
  monthCosts,
  monthRange,
  previousMonth,
} from './common/managementSummary';

const useStyles = makeStyles()((theme) => ({
  root: {
    maxWidth: 960,
    margin: theme.spacing(0, 3, 3),
    padding: theme.spacing(3),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 0, 2),
      padding: theme.spacing(2),
      borderRadius: 0,
    },
    '@media print': {
      margin: 0,
      padding: 0,
      border: 'none',
      maxWidth: 'none',
    },
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  tables: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing(3),
    '& table': { breakInside: 'avoid' },
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  noPrint: {
    '@media print': { display: 'none' },
  },
}));

const query = (deviceIds, from, to, extra = {}) => {
  const params = new URLSearchParams({ from, to, ...extra });
  deviceIds.forEach((id) => params.append('deviceId', id));
  return params;
};

const loadMonth = async (deviceIds, month, signal) => {
  const { from, to } = monthRange(month);
  const headers = { Accept: 'application/json' };
  const events = query(deviceIds, from, to);
  events.append('type', 'deviceOverspeed');
  events.append('type', 'alarm');
  const [summary, eventRows] = await Promise.all([
    fetchOrThrow(`api/reports/summary?${query(deviceIds, from, to)}`, { signal, headers }).then(
      (response) => response.json(),
    ),
    fetchOrThrow(`api/reports/events?${events}`, { signal, headers })
      .then((response) => response.json())
      .catch(() => []),
  ]);
  return { summary, events: eventCounts(eventRows) };
};

const countIncidents = async (month) => {
  const { from, to } = monthRange(month);
  const { count } = await getFleetClient()
    .from('incidents')
    .select('id', { count: 'exact', head: true })
    .gte('occurred_at', from)
    .lte('occurred_at', to);
  return count ?? null;
};

// /reports/management (REP-16, REP-23): the month on one page for the management: kilometers,
// engine hours, vehicles in use, fuel, speeding, costs and incidents against the month before,
// the most and least used vehicles and the costs by kind. Prints as an A4 document.
const ManagementSummaryPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const distanceUnit = useAttributePreference('distanceUnit');
  const devices = useSelector((state) => state.devices.items);
  const fleetReady = useSelector((state) => state.fleet.status === 'ready');
  const canCosts = useFleetPermission('costs.read');
  const canIncidents = useFleetPermission('incidents.read');
  const [month, setMonth] = usePersistedState('managementMonth', lastMonth());
  const [data, setData] = useState(null);
  const deviceList = useMemo(() => Object.values(devices), [devices]);
  const deviceKey = deviceList.map((device) => device.id).join(',');
  // Devices change with every status update; the summary reloads only when the list does.
  const deviceListRef = useRef(deviceList);
  deviceListRef.current = deviceList;

  useAsyncTask(
    async ({ signal }) => {
      setData(null);
      const vehicles = deviceListRef.current;
      if (!/^\d{4}-\d{2}$/.test(month) || !deviceKey) return;
      const ids = vehicles.map((device) => device.id);
      const before = previousMonth(month);
      const withFleet = fleetReady;
      const [current, earlier, costs, incidents, incidentsBefore] = await Promise.all([
        loadMonth(ids, month, signal),
        loadMonth(ids, before, signal),
        withFleet && canCosts ? loadCosts(14).catch(() => null) : null,
        withFleet && canIncidents ? countIncidents(month).catch(() => null) : null,
        withFleet && canIncidents ? countIncidents(before).catch(() => null) : null,
      ]);
      setData({
        current: { ...fleetMonth(current.summary, vehicles), events: current.events },
        earlier: { ...fleetMonth(earlier.summary, vehicles), events: earlier.events },
        costs: costs ? monthCosts(costs, month) : null,
        costsBefore: costs ? monthCosts(costs, before) : null,
        incidents,
        incidentsBefore,
      });
    },
    [month, deviceKey, fleetReady, canCosts, canIncidents],
  );

  const km = (value) => formatDistance(value, distanceUnit, t);
  const hint = (current, earlier) => changeHint(t, current, earlier);
  const { from, to } = /^\d{4}-\d{2}$/.test(month) ? monthRange(month) : {};

  const tiles = data
    ? [
        {
          key: 'distance',
          icon: <RouteRoundedIcon />,
          label: t('sharedDistance'),
          value: km(data.current.distance),
          hint: hint(data.current.distance, data.earlier.distance),
        },
        {
          key: 'hours',
          icon: <TimerRoundedIcon />,
          label: t('reportEngineHours'),
          value: formatNumericHours(data.current.engineHours, t),
          hint: hint(data.current.engineHours, data.earlier.engineHours),
        },
        {
          key: 'active',
          icon: <DirectionsCarRoundedIcon />,
          label: t('managementActiveVehicles'),
          value: `${data.current.active} / ${data.current.count}`,
          hint: hint(data.current.active, data.earlier.active),
        },
        data.current.spentFuel > 0 && {
          key: 'fuel',
          icon: <LocalGasStationRoundedIcon />,
          label: t('reportSpentFuel'),
          value: Math.round(data.current.spentFuel).toLocaleString('en-US'),
          hint: hint(data.current.spentFuel, data.earlier.spentFuel),
        },
        {
          key: 'speeding',
          icon: <SpeedRoundedIcon />,
          label: t('eventDeviceOverspeed'),
          value: data.current.events.speeding,
          hint: hint(data.current.events.speeding, data.earlier.events.speeding),
        },
        data.costs && {
          key: 'costs',
          icon: <PaidRoundedIcon />,
          label: t('managementCosts'),
          value: money(data.costs.total),
          hint: hint(data.costs.total, data.costsBefore?.total),
        },
        data.incidents != null && {
          key: 'incidents',
          icon: <CarCrashRoundedIcon />,
          label: t('fleetIncidentsPage'),
          value: data.incidents,
          hint: hint(data.incidents, data.incidentsBefore),
        },
      ].filter(Boolean)
    : [];

  const vehicleTable = (titleKey, rows) => (
    <div>
      <Typography variant="subtitle2" component="h2" gutterBottom>
        {t(titleKey)}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedDevice')}</TableCell>
            <TableCell align="right">{t('sharedDistance')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.deviceId}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="right" className={classes.number}>
                {km(row.distance)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportManagement']}>
      <Paper elevation={0} variant="outlined" className={classes.root}>
        <DocumentPrintHeader
          kind="MANAGEMENT SUMMARY"
          portrait
          title={t('reportManagement')}
          lines={
            from
              ? [
                  <bdi key="range" dir="ltr">
                    {`${formatTime(from, 'date')} – ${formatTime(to, 'date')}`}
                  </bdi>,
                  `${t('deviceTitle')}: ${deviceList.length}`,
                ]
              : []
          }
        />
        <Stack
          direction="row"
          spacing={2}
          className={classes.noPrint}
          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
        >
          <TextField
            type="month"
            size="small"
            label={t('managementMonth')}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { dir: 'ltr' } }}
          />
          <Typography variant="body2" color="textSecondary" sx={{ flex: 1, minWidth: 200 }}>
            {t('managementHint')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<PrintRoundedIcon />}
            onClick={() => window.print()}
            disabled={!data}
          >
            {t('dashboardPrint')}
          </Button>
        </Stack>
        {!data ? (
          <Table>
            <TableBody>
              <TableShimmer columns={3} />
            </TableBody>
          </Table>
        ) : (
          <>
            <div className={classes.tiles}>
              {tiles.map((tile) => (
                <KpiTile
                  key={tile.key}
                  layout="inline"
                  size="sm"
                  icon={tile.icon}
                  label={tile.label}
                  value={tile.value}
                  hint={tile.hint}
                />
              ))}
            </div>
            <div className={classes.tables}>
              {vehicleTable('managementMostUsed', data.current.vehicles.slice(0, 5))}
              {vehicleTable(
                'managementLeastUsed',
                [...data.current.vehicles].reverse().slice(0, 5),
              )}
              {data.costs && data.costs.total > 0 && (
                <div>
                  <Typography variant="subtitle2" component="h2" gutterBottom>
                    {t('managementCostsByKind')}
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      {['fuel', 'maintenance', 'other'].map((key) => (
                        <TableRow key={key}>
                          <TableCell>
                            {t(`fleetCost${key[0].toUpperCase()}${key.slice(1)}`)}
                          </TableCell>
                          <TableCell align="right" className={classes.number}>
                            {money(data.costs[key])}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </Paper>
    </PageLayout>
  );
};

export default ManagementSummaryPage;
