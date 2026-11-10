import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Chip,
  Link,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import CheckInQrDialog from './components/CheckInQrDialog';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import FleetDocumentsSection from '../settings/components/FleetDocumentsSection';
import HistorySection from './components/HistorySection';
import TiresSection from './components/TiresSection';
import useActivityText, { toneColor } from '../common/components/useActivityText';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatDistance, formatTime, getFormatLocale } from '../common/util/formatter';
import { vehicleFields } from '../common/fleet/fleetFields';
import { useAttributePreference } from '../common/util/preferences';
import { formatDays } from '../common/util/plural';
import DeviceTile from '../common/components/brand/DeviceTile';
import { getFleetClient } from '../common/fleet/client';
import { useFleetPermission, useFleetReady } from '../common/fleet/useFleet';
import { useLivePosition } from '../common/fleet/usePrivacy';
import { periodStart } from '../common/fleet/costs';
import {
  monthCost,
  nearestExpiry,
  nextMaintenance,
  openWorkOrders,
} from '../common/fleet/vehicle360';
import { devicesActions } from '../store';
import useExpiries from './useExpiries';
import { money } from './fleetData';
import { monthlyBenefit, propulsionOf } from '../common/fleet/benefit';
import { workOrderStatusKey } from './WorkOrdersPage';
import { incidentKey } from './IncidentsPage';
import { capitalize } from '../common/util/stringUtils';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 3, 3),
    maxWidth: 1180,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  identity: {
    flex: 1,
    minWidth: 200,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.palette.text.secondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: theme.spacing(1.5),
  },
  tile: {
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minHeight: 84,
  },
  // Slate on ice misses AA; tiles use the tint's own secondary shade (as ExpiryTiles do).
  tileLabel: {
    color: theme.palette.surface.textSecondaryOnTint,
  },
  tileValue: {
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  panel: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.divider}`,
    overflowX: 'auto',
  },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    gap: theme.spacing(1, 3),
  },
}));

// Vehicle details shown on the overview, labelled as on the vehicle form.
const FACT_FIELDS = vehicleFields.filter((field) =>
  ['make', 'vehicleModel', 'modelYear', 'vin'].includes(field.key),
);
const monthLabel = (month) =>
  new Intl.DateTimeFormat(getFormatLocale(), { month: 'long', year: 'numeric' }).format(
    new Date(`${month}-01T00:00:00`),
  );

const TABS = [
  'overview',
  'maintenance',
  'incidents',
  'inspections',
  'costs',
  'documents',
  'history',
];

const monthStartIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

// Traccar side: this month's distance and the maintenance plan of the vehicle.
const useTraccarFacts = (deviceId) => {
  const [facts, setFacts] = useState({ distance: null, maintenances: [] });
  useAsyncTask(
    async ({ signal }) => {
      const query = new URLSearchParams({
        deviceId,
        from: monthStartIso(),
        to: new Date().toISOString(),
      });
      const [summary, maintenances] = await Promise.all([
        fetchOrThrow(`api/reports/summary?${query}`, {
          headers: { Accept: 'application/json' },
          signal,
        }).then((response) => response.json()),
        fetchOrThrow(`api/maintenance?deviceId=${deviceId}`, { signal }).then((response) =>
          response.json(),
        ),
      ]);
      setFacts({ distance: summary?.[0]?.distance ?? null, maintenances });
    },
    [deviceId],
  );
  return facts;
};

// Fleet database side: the vehicle row and what hangs off it.
const useFleetFacts = (deviceId) => {
  const ready = useFleetReady();
  const [facts, setFacts] = useState(null);
  useAsyncTask(async () => {
    if (!ready) {
      return;
    }
    const client = getFleetClient();
    const { data: vehicle } = await client
      .from('vehicles')
      .select('id, plate_number, checkin_code')
      .eq('traccar_device_id', deviceId)
      .maybeSingle();
    if (!vehicle) {
      setFacts({ vehicle: null });
      return;
    }
    const rows = (result) => result.data || [];
    const [assignment, workOrders, incidents, inspections, costs] = await Promise.all([
      client.from('current_assignments').select('*').eq('vehicle_id', vehicle.id).limit(1),
      client
        .from('work_orders')
        .select('id, number, title, type, status, opened_at, total_cost')
        .eq('vehicle_id', vehicle.id)
        .order('opened_at', { ascending: false })
        .limit(20),
      client
        .from('incidents')
        .select('id, number, type, status, occurred_at, injuries')
        .eq('vehicle_id', vehicle.id)
        .order('occurred_at', { ascending: false })
        .limit(20),
      client
        .from('inspections')
        .select('id, template_name, started_at, result')
        .eq('vehicle_id', vehicle.id)
        .order('started_at', { ascending: false })
        .limit(20),
      client
        .from('vehicle_monthly_costs')
        .select('month, category, amount')
        .eq('vehicle_id', vehicle.id)
        .gte('month', periodStart(6)),
    ]);
    const current = rows(assignment)[0] || null;
    const driver = current?.driver_id
      ? (await client.from('drivers').select('full_name').eq('id', current.driver_id).maybeSingle())
          .data
      : null;
    setFacts({
      vehicle,
      driverName: driver?.full_name || null,
      workOrders: rows(workOrders),
      incidents: rows(incidents),
      inspections: rows(inspections),
      costs: rows(costs),
    });
  }, [ready, deviceId]);
  return facts;
};

const Tile = ({ label, value, hint }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.tile}>
      <Typography variant="body2" className={classes.tileLabel}>
        {label}
      </Typography>
      <Typography variant="h6" component="p" className={classes.tileValue}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" className={classes.tileLabel}>
          {hint}
        </Typography>
      )}
    </div>
  );
};

const RowsTable = ({ head, rows, empty }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <Paper elevation={0} className={classes.panel}>
      {rows.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              {head.map((key) => (
                <TableCell key={key}>{t(key)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>{rows}</TableBody>
        </Table>
      ) : (
        <Typography variant="body2" color="textSecondary">
          {t(empty)}
        </Typography>
      )}
    </Paper>
  );
};

// /fleet/vehicle/:id (ADM-12): one vehicle at a glance. Who drives it, where it is, what it costs,
// what is open and what is due, with the detail in tabs. Editing stays in the vehicle form.
const VehiclePage = () => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { id } = useParams();
  const deviceId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const device = useSelector((state) => state.devices.items[deviceId]);
  const benefit = monthlyBenefit(
    device?.attributes?.listPrice,
    propulsionOf(device?.attributes?.fuelType),
  );
  const position = useLivePosition(deviceId);
  const distanceUnit = useAttributePreference('distanceUnit');
  const canDocuments = useFleetPermission('documents.read');
  const { label: activity, tone } = useActivityText(device, position);
  const expiries = useExpiries();
  const traccar = useTraccarFacts(deviceId);
  const fleet = useFleetFacts(deviceId);
  // SAF-02: the cabin QR for the drivers' check-in.
  const canWriteVehicles = useFleetPermission('vehicles.write');
  const [qrOpen, setQrOpen] = useState(false);

  const expiry = nearestExpiry(expiries.rows, deviceId);
  const maintenance = nextMaintenance(traccar.maintenances, position);
  const open = fleet?.workOrders ? openWorkOrders(fleet.workOrders) : null;
  const cost = fleet?.costs ? monthCost(fleet.costs, periodStart(1)) : null;
  const plate = device?.attributes?.plateNumber || fleet?.vehicle?.plate_number;

  const costMonths = useMemo(() => {
    const byMonth = new Map();
    (fleet?.costs || []).forEach((row) => {
      const month = String(row.month).slice(0, 7);
      const line = byMonth.get(month) || { month, fuel: 0, maintenance: 0, other: 0 };
      const bucket = ['fuel', 'maintenance'].includes(row.category) ? row.category : 'other';
      line[bucket] += Number(row.amount) || 0;
      byMonth.set(month, line);
    });
    return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  }, [fleet]);

  if (!device) {
    return (
      <PageLayout menu={<SettingsMenu />} breadcrumbs={['fleetTitle', 'deviceTitle']}>
        <div className={classes.root}>
          <Typography color="textSecondary">{t('vehicleNotFound')}</Typography>
        </div>
      </PageLayout>
    );
  }

  const dash = '—';

  const showOnMap = () => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/');
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'deviceTitle']}
      title={device.name}
    >
      <div className={classes.root}>
        <div className={classes.head}>
          <DeviceTile category={device.category} status={device.status} size={56} />
          <div className={classes.identity}>
            {plate && (
              <Typography variant="h6" component="p" dir="ltr" sx={{ textAlign: 'start' }}>
                {plate}
              </Typography>
            )}
            <Typography variant="body2" className={classes.status}>
              <span className={classes.dot} style={{ backgroundColor: toneColor(theme, tone) }} />
              {activity}
              {fleet?.driverName && ` · ${t('sharedDriver')}: ${fleet.driverName}`}
            </Typography>
          </div>
          <div className={classes.actions}>
            <Button startIcon={<MapRoundedIcon />} onClick={showOnMap}>
              {t('vehicleShowOnMap')}
            </Button>
            <Button
              startIcon={<RouteRoundedIcon />}
              component={RouterLink}
              to={`/replay?deviceId=${deviceId}`}
            >
              {t('reportReplay')}
            </Button>
            {fleet?.vehicle?.checkin_code && canWriteVehicles && (
              <Button startIcon={<QrCode2RoundedIcon />} onClick={() => setQrOpen(true)}>
                {t('checkinQrTitle')}
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<EditRoundedIcon />}
              component={RouterLink}
              to={`/settings/device/${deviceId}`}
            >
              {t('vehicleEdit')}
            </Button>
          </div>
        </div>

        <div className={classes.tiles}>
          <Tile
            label={t('vehicleKmMonth')}
            value={
              traccar.distance == null ? dash : formatDistance(traccar.distance, distanceUnit, t)
            }
          />
          <Tile
            label={t('vehicleCostMonth')}
            value={cost == null ? dash : money(cost) || money(0)}
          />
          <Tile label={t('vehicleOpenWorkOrders')} value={open == null ? dash : open.length} />
          <Tile
            label={t('vehicleNextMaintenance')}
            value={maintenance ? maintenance.maintenance.name : dash}
            hint={
              maintenance && maintenance.state.status !== 'unknown'
                ? t(`vehicleMaintenance${capitalize(maintenance.state.status)}`)
                : undefined
            }
          />
          <Tile
            label={t('vehicleValidity')}
            value={expiry ? t(expiry.labelKey) : t('vehicleValidityNone')}
            hint={
              expiry &&
              (expiry.days < 0
                ? `${t('fleetViolationOverdue')} ${formatDays(expiry.days, t)}`
                : t('fleetViolationDaysLeft').replace('{0}', formatDays(expiry.days, t)))
            }
          />
        </div>

        <Tabs
          value={tab}
          onChange={(_, value) => setSearchParams({ tab: value }, { replace: true })}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={device.name}
        >
          {TABS.map((key) => (
            <Tab key={key} value={key} label={t(`vehicleTab${capitalize(key)}`)} />
          ))}
        </Tabs>

        {tab === 'overview' && (
          <Paper elevation={0} className={classes.panel}>
            <div className={classes.facts}>
              <Typography color="textSecondary">{t('deviceStatus')}</Typography>
              <Typography>{activity}</Typography>
              <Typography color="textSecondary">{t('positionAddress')}</Typography>
              <Typography>
                {position?.address ||
                  (position
                    ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
                    : dash)}
              </Typography>
              <Typography color="textSecondary">{t('deviceLastUpdate')}</Typography>
              <Typography>
                {device.lastUpdate ? formatTime(device.lastUpdate, 'minutes') : dash}
              </Typography>
              <Typography color="textSecondary">{t('deviceIdentifier')}</Typography>
              <Typography dir="ltr" sx={{ justifySelf: 'start' }}>
                {device.uniqueId}
              </Typography>
              {FACT_FIELDS.map(
                ({ key, labelKey }) =>
                  device.attributes?.[key] && [
                    <Typography key={`${key}-label`} color="textSecondary">
                      {t(labelKey)}
                    </Typography>,
                    <Typography key={key}>{device.attributes[key]}</Typography>,
                  ],
              )}
              {benefit != null && [
                <Typography key="benefit-label" color="textSecondary">
                  {t('fleetMonthlyBenefit')}
                </Typography>,
                <Typography key="benefit">
                  {`${money(benefit)} · ${t('fleetMonthlyBenefitHint')}`}
                </Typography>,
              ]}
            </div>
          </Paper>
        )}

        {tab === 'maintenance' && (
          <>
            <RowsTable
              head={['sharedName', 'deviceStatus']}
              empty="vehicleNoMaintenance"
              rows={traccar.maintenances.map((item) => {
                const state = nextMaintenance([item], position)?.state;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      {state && state.status !== 'unknown'
                        ? t(`vehicleMaintenance${capitalize(state.status)}`)
                        : dash}
                    </TableCell>
                  </TableRow>
                );
              })}
            />
            <RowsTable
              head={['fleetWorkOrderNumber', 'sharedName', 'deviceStatus', 'fleetWorkOrderTotal']}
              empty="vehicleNoWorkOrders"
              rows={(fleet?.workOrders || []).map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/fleet/work-order/${order.id}`}>
                      #{order.number}
                    </Link>
                  </TableCell>
                  <TableCell>{order.title}</TableCell>
                  <TableCell>{t(workOrderStatusKey(order.status))}</TableCell>
                  <TableCell>{money(order.total_cost)}</TableCell>
                </TableRow>
              ))}
            />
            <TiresSection device={device} position={position} />
          </>
        )}

        {tab === 'incidents' && (
          <RowsTable
            head={['fleetIncidentOccurred', 'sharedType', 'deviceStatus']}
            empty="vehicleNoIncidents"
            rows={(fleet?.incidents || []).map((incident) => (
              <TableRow key={incident.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={`/fleet/incident/${incident.id}`}>
                    {formatTime(incident.occurred_at, 'minutes')}
                  </Link>
                </TableCell>
                <TableCell>
                  {t(incidentKey('Type', incident.type))}
                  {incident.injuries && (
                    <Chip
                      size="small"
                      color="error"
                      sx={{ mx: 0.5 }}
                      label={t('vehicleInjuries')}
                    />
                  )}
                </TableCell>
                <TableCell>{t(incidentKey('Status', incident.status))}</TableCell>
              </TableRow>
            ))}
          />
        )}

        {tab === 'inspections' && (
          <RowsTable
            head={['fleetExpenseDate', 'fleetInspectionTemplate', 'deviceStatus']}
            empty="vehicleNoInspections"
            rows={(fleet?.inspections || []).map((inspection) => (
              <TableRow key={inspection.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={`/fleet/inspection/${inspection.id}`}>
                    {formatTime(inspection.started_at, 'minutes')}
                  </Link>
                </TableCell>
                <TableCell>{inspection.template_name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={inspection.result === 'pass' ? 'success' : 'error'}
                    label={t(
                      inspection.result === 'pass' ? 'fleetInspectionPass' : 'fleetInspectionFail',
                    )}
                  />
                </TableCell>
              </TableRow>
            ))}
          />
        )}

        {tab === 'costs' && (
          <RowsTable
            head={['vehicleMonth', 'fleetCostFuel', 'fleetCostMaintenance', 'fleetCostOther']}
            empty="vehicleNoCosts"
            rows={costMonths.map((line) => (
              <TableRow key={line.month}>
                <TableCell>{monthLabel(line.month)}</TableCell>
                <TableCell>{money(line.fuel)}</TableCell>
                <TableCell>{money(line.maintenance)}</TableCell>
                <TableCell>{money(line.other)}</TableCell>
              </TableRow>
            ))}
          />
        )}

        {tab === 'documents' &&
          (canDocuments ? (
            <FleetDocumentsSection
              entity="vehicle"
              traccarId={device.id}
              name={device.name}
              identifier={device.uniqueId}
            />
          ) : (
            <Typography color="textSecondary">{t('vehicleNoDocuments')}</Typography>
          ))}

        {tab === 'history' && <HistorySection entity="vehicle" traccarId={device.id} />}
      </div>
      {qrOpen && fleet?.vehicle && (
        <CheckInQrDialog
          vehicle={fleet.vehicle}
          deviceId={deviceId}
          name={device.name}
          onClose={() => setQrOpen(false)}
        />
      )}
    </PageLayout>
  );
};

export default VehiclePage;
