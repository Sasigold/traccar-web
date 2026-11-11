import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ThermostatRoundedIcon from '@mui/icons-material/ThermostatRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import TableToolbar from '../common/components/table/TableToolbar';
import SettingsMenu from '../settings/components/SettingsMenu';
import { useCatch } from '../reactHelper';
import { formatTemperature, formatTime } from '../common/util/formatter';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { useFleetPermission, useFleetProfile, useFleetReady } from '../common/fleet/useFleet';
import { sensorRows } from '../common/fleet/sensors';
import { ensureVehicle } from './fleetData';
import { toNumber, useFleetRows } from './fleetRows';
import { keepOnBackdrop } from '../common/util/formDialog';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
    },
  },
  chips: {
    display: 'flex',
    gap: theme.spacing(0.5),
    flexWrap: 'wrap',
  },
  number: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  action: {
    width: '1%',
  },
}));

const stateColor = { ok: 'success', low: 'error', high: 'error', none: 'default' };

const LimitsDialog = ({ device, limits, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const [form, setForm] = useState({
    temp_min: limits?.temp_min ?? '',
    temp_max: limits?.temp_max ?? '',
    battery_min: limits?.battery_min ?? '',
  });

  const save = useCatch(async () => {
    const vehicleId = limits?.id || (await ensureVehicle(device, profile));
    unwrap(
      await getFleetClient()
        .from('vehicles')
        .update({
          temp_min: toNumber(form.temp_min),
          temp_max: toNumber(form.temp_max),
          battery_min: toNumber(form.battery_min),
        })
        .eq('id', vehicleId),
    );
    onSaved();
  });

  const field = (key, labelKey) => (
    <TextField
      type="number"
      label={t(labelKey)}
      value={form[key]}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      slotProps={{ htmlInput: { dir: 'ltr' } }}
    />
  );

  return (
    <Dialog open onClose={keepOnBackdrop(onClose)} fullWidth maxWidth="sm">
      <DialogTitle>
        {t('fleetSensorsLimits')} · {device.name}
      </DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          {field('temp_min', 'fleetSensorsTempMin')}
          {field('temp_max', 'fleetSensorsTempMax')}
          {field('battery_min', 'fleetSensorsBatteryMin')}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// EV battery and cold chain temperatures, live, against limits per vehicle.
const SensorsPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const ready = useFleetReady();
  const canRead = useFleetPermission('vehicles.read');
  const canWrite = useFleetPermission('vehicles.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [search, setSearch] = useState('');
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [editing, setEditing] = useState(null);

  const limitRows = useFleetRows('vehicles', {
    select: 'id, traccar_device_id, temp_min, temp_max, battery_min',
    enabled: ready && canRead,
    reloadKey,
  });
  const limitsByDevice = useMemo(
    () =>
      Object.fromEntries(
        (limitRows || [])
          .filter((row) => row.traccar_device_id)
          .map((row) => [row.traccar_device_id, row]),
      ),
    [limitRows],
  );

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return sensorRows(devices, positions, limitsByDevice).filter(
      (row) =>
        (!alertsOnly || row.alert) && (!keyword || row.device.name.toLowerCase().includes(keyword)),
    );
  }, [devices, positions, limitsByDevice, search, alertsOnly]);

  const limitText = (limits) =>
    [
      limits?.temp_min != null || limits?.temp_max != null
        ? `${limits?.temp_min ?? '…'} – ${limits?.temp_max ?? '…'}°C`
        : null,
      limits?.battery_min != null ? `≥ ${limits.battery_min}%` : null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'fleetSensorsPage']}
      description={t('fleetSensorsPageDescription')}
    >
      <DataTable
        toolbar={
          <TableToolbar
            search={{ value: search, onChange: setSearch }}
            count={rows.length}
            filters={[false, true].map((value) => (
              <Chip
                key={String(value)}
                size="small"
                label={t(value ? 'fleetSensorsAlertsOnly' : 'fleetFilterAll')}
                color={alertsOnly === value ? 'primary' : 'default'}
                variant={alertsOnly === value ? 'filled' : 'outlined'}
                onClick={() => setAlertsOnly(value)}
              />
            ))}
          />
        }
        empty={rows.length === 0}
        emptyState={{ icon: <ThermostatRoundedIcon />, title: t('fleetSensorsNone') }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t('fleetEntityVehicle')}</TableCell>
            <TableCell>{t('positionBatteryLevel')}</TableCell>
            <TableCell>{t('fleetSensorsTemperatures')}</TableCell>
            <TableCell>{t('fleetSensorsLimits')}</TableCell>
            <TableCell>{t('fleetSensorsUpdated')}</TableCell>
            {canWrite && <TableCell className={classes.action} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const limits = limitsByDevice[row.device.id];
            return (
              <TableRow key={row.device.id} hover>
                <TableCell>{row.device.name}</TableCell>
                <TableCell>
                  {row.battery !== null && (
                    <Chip
                      size="small"
                      color={stateColor[row.batteryState]}
                      variant="outlined"
                      icon={row.charging ? <BoltRoundedIcon /> : undefined}
                      label={<span dir="ltr">{`${Math.round(row.battery)}%`}</span>}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <div className={classes.chips}>
                    {row.temperatures.map((reading) => (
                      <Tooltip key={reading.key} title={reading.key}>
                        <Chip
                          size="small"
                          color={stateColor[reading.state]}
                          variant="outlined"
                          label={<span dir="ltr">{formatTemperature(reading.value)}</span>}
                        />
                      </Tooltip>
                    ))}
                  </div>
                </TableCell>
                <TableCell className={classes.number}>
                  <span dir="ltr">{limitText(limits)}</span>
                </TableCell>
                <TableCell className={classes.number}>
                  {positions[row.device.id]?.fixTime
                    ? formatTime(positions[row.device.id].fixTime, 'minutes')
                    : ''}
                </TableCell>
                {canWrite && (
                  <TableCell className={classes.action}>
                    <Tooltip title={t('fleetSensorsLimits')}>
                      <IconButton
                        size="small"
                        aria-label={t('fleetSensorsLimits')}
                        onClick={() => setEditing({ device: row.device, limits })}
                      >
                        <TuneRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </DataTable>
      {editing && (
        <LimitsDialog
          device={editing.device}
          limits={editing.limits}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </PageLayout>
  );
};

export default SensorsPage;
