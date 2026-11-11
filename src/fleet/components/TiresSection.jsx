import { useMemo, useReducer, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import TireRepairRoundedIcon from '@mui/icons-material/TireRepairRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { getFleetClient, unwrap } from '../../common/fleet/client';
import { useFleetPermission, useFleetProfile } from '../../common/fleet/useFleet';
import { formatTime } from '../../common/util/formatter';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { DateField } from '../../common/components/pickers';
import { odometerKm } from '../../common/fleet/workOrders';
import {
  slowLeak,
  tireCostPerKm,
  tirePositions,
  treadStatus,
  TREAD_LEGAL_MM,
} from '../../common/fleet/tires';
import { detectWheels } from '../../common/components/telemetry/vehicleProfile';
import { ensureVehicle, money } from '../fleetData';

const useStyles = makeStyles()((theme) => ({
  panel: {
    padding: theme.spacing(2, 2.5),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
    '& > svg': { color: theme.palette.primary.main },
  },
  title: {
    flex: 1,
    fontWeight: 600,
  },
  form: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    paddingTop: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  number: {
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
}));

const REMOVE_REASONS = ['worn', 'damaged', 'puncture', 'season', 'rotation', 'other'];
const LEAK_DAYS = 7;
const statusChip = { error: 'error', warning: 'warning', ok: 'success' };

const TireDialog = ({ tire, positions, odometer, onClose, onSave }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const [form, setForm] = useState(() => ({
    position: tire?.position || positions[0],
    brand: '',
    model: '',
    size: tire?.size || '',
    installed_at: new Date().toISOString().slice(0, 10),
    installed_odometer: odometer ?? '',
    cost: '',
    removed_reason: tire ? 'worn' : '',
  }));
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(tire ? 'tireReplace' : 'tireAdd')}</DialogTitle>
      <DialogContent>
        <div className={classes.form}>
          <TextField
            select
            label={t('tirePosition')}
            value={form.position}
            onChange={set('position')}
            disabled={Boolean(tire)}
          >
            {positions.map((position) => (
              <MenuItem key={position} value={position}>
                {t(`tirePosition_${position}`)}
              </MenuItem>
            ))}
          </TextField>
          {tire && (
            <TextField
              select
              label={t('tireRemovedReason')}
              value={form.removed_reason}
              onChange={set('removed_reason')}
            >
              {REMOVE_REASONS.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {t(`tireReason_${reason}`)}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField label={t('tireBrand')} value={form.brand} onChange={set('brand')} />
          <TextField label={t('tireModel')} value={form.model} onChange={set('model')} />
          <TextField
            label={t('tireSize')}
            value={form.size}
            onChange={set('size')}
            placeholder="205/55 R16"
            slotProps={{ htmlInput: { dir: 'ltr' } }}
          />
          <DateField
            label={t('tireInstalledAt')}
            value={form.installed_at}
            onChange={set('installed_at')}
          />
          <TextField
            type="number"
            label={t('tireInstalledKm')}
            value={form.installed_odometer}
            onChange={set('installed_odometer')}
            slotProps={{ htmlInput: { min: 0, inputMode: 'numeric' } }}
          />
          <TextField
            type="number"
            label={t('tireCost')}
            value={form.cost}
            onChange={set('cost')}
            slotProps={{ htmlInput: { min: 0, inputMode: 'decimal' } }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button variant="contained" onClick={() => onSave(form)}>
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const TreadDialog = ({ onClose, onSave }) => {
  const t = useTranslation();
  const [depth, setDepth] = useState('');
  const value = Number(String(depth).replace(',', '.'));
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('tireTreadAdd')}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          autoFocus
          label={t('tireTreadMm')}
          value={depth}
          onChange={(event) => setDepth(event.target.value)}
          helperText={t('tireTreadHelp').replace('{0}', String(TREAD_LEGAL_MM))}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('sharedCancel')}</Button>
        <Button
          variant="contained"
          disabled={!(value >= 0 && value <= 30) || depth === ''}
          onClick={() => onSave(value)}
        >
          {t('sharedSave')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// OPS-07: the vehicle's tires: what is on each wheel since when and at what km, its cost per
// km, the latest tread depth (from the morning check or by hand), and a slow leak found in the
// TPMS pressure of the last week.
const TiresSection = ({ device, position }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const canRead = useFleetPermission('maintenance.read');
  const canWrite = useFleetPermission('maintenance.write');
  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [data, setData] = useState(null);
  const [leaks, setLeaks] = useState([]);
  const [dialog, setDialog] = useState(null);
  const odometer = odometerKm(position);
  const wheels = useMemo(() => detectWheels(position), [position]);

  useAsyncTask(async () => {
    void reloadKey;
    if (!canRead || !device?.id) return;
    const client = getFleetClient();
    const vehicle = unwrap(
      await client.from('vehicles').select('id').eq('traccar_device_id', device.id).maybeSingle(),
    );
    if (!vehicle) {
      setData({ vehicleId: null, tires: [], tread: null });
      return;
    }
    const [tires, readings] = await Promise.all([
      client
        .from('vehicle_tires')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('installed_at', { ascending: false })
        .then(unwrap),
      client
        .from('tire_tread_readings')
        .select('depth_mm, measured_at, source')
        .eq('vehicle_id', vehicle.id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .then(unwrap),
    ]);
    setData({ vehicleId: vehicle.id, tires: tires || [], tread: (readings || [])[0] || null });
  }, [canRead, device?.id, reloadKey]);

  // The pressure of the last week, only for a vehicle that reports it.
  useAsyncTask(
    async ({ signal }) => {
      const keys = Object.entries(wheels);
      if (!canRead || !device?.id || !keys.length) return;
      const to = new Date();
      const from = new Date(to.getTime() - LEAK_DAYS * 24 * 3600 * 1000);
      const query = new URLSearchParams({
        deviceId: device.id,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetchOrThrow(`api/positions?${query}`, { signal });
      const history = await response.json();
      setLeaks(
        keys
          .map(([wheel, key]) => ({
            wheel,
            leak: slowLeak(
              history.map((item) => ({ time: item.fixTime, value: item.attributes?.[key] })),
            ),
          }))
          .filter((item) => item.leak),
      );
    },
    [canRead, device?.id, wheels],
  );

  const save = useCatch(async (form) => {
    const client = getFleetClient();
    const vehicleId = data.vehicleId || (await ensureVehicle(device, profile));
    const today = new Date().toISOString().slice(0, 10);
    const replaced = dialog?.tire;
    if (replaced) {
      unwrap(
        await client
          .from('vehicle_tires')
          .update({
            removed_at: form.installed_at || today,
            removed_odometer:
              form.installed_odometer === '' ? null : Number(form.installed_odometer),
            removed_reason: form.removed_reason || null,
          })
          .eq('id', replaced.id),
      );
    }
    unwrap(
      await client.from('vehicle_tires').insert({
        org_id: profile.org_id,
        vehicle_id: vehicleId,
        position: form.position,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        size: form.size.trim() || null,
        installed_at: form.installed_at || today,
        installed_odometer: form.installed_odometer === '' ? null : Number(form.installed_odometer),
        cost: form.cost === '' ? null : Number(form.cost),
      }),
    );
    setDialog(null);
    reload();
  });

  const saveTread = useCatch(async (depth) => {
    const vehicleId = data.vehicleId || (await ensureVehicle(device, profile));
    unwrap(
      await getFleetClient()
        .from('tire_tread_readings')
        .insert({ org_id: profile.org_id, vehicle_id: vehicleId, depth_mm: depth }),
    );
    setDialog(null);
    reload();
  });

  if (!canRead) return null;

  const mounted = (data?.tires || []).filter((tire) => !tire.removed_at);
  const positions = tirePositions();
  const free = positions.filter((key) => !mounted.some((tire) => tire.position === key));
  const tread = data?.tread;
  const status = treadStatus(tread?.depth_mm);

  return (
    <Paper
      elevation={0}
      className={classes.panel}
      component="section"
      aria-labelledby="tires-title"
    >
      <div className={classes.head}>
        <TireRepairRoundedIcon />
        <Typography id="tires-title" variant="subtitle1" component="h2" className={classes.title}>
          {t('tiresTitle')}
        </Typography>
        {tread && (
          <Chip
            size="small"
            color={statusChip[status] || 'default'}
            label={`${t('tireTread')}: ${tread.depth_mm} ${t('tireMm')} · ${formatTime(tread.measured_at, 'date')}`}
          />
        )}
        {canWrite && (
          <>
            <Button size="small" onClick={() => setDialog({ type: 'tread' })}>
              {t('tireTreadAdd')}
            </Button>
            {free.length > 0 && (
              <Button size="small" variant="outlined" onClick={() => setDialog({ type: 'tire' })}>
                {t('tireAdd')}
              </Button>
            )}
          </>
        )}
      </div>
      {leaks.map(({ wheel, leak }) => (
        <Alert key={wheel} severity="warning">
          {t('tireSlowLeak')
            .replace('{0}', t(`tirePosition_${wheel}`))
            .replace('{1}', leak.perDay.toFixed(2))
            .replace('{2}', String(Math.max(1, Math.round(leak.daysToLow))))}
        </Alert>
      ))}
      {status === 'error' && <Alert severity="error">{t('tireTreadIllegal')}</Alert>}
      {mounted.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('tirePosition')}</TableCell>
              <TableCell>{t('tireModel')}</TableCell>
              <TableCell>{t('tireInstalledAt')}</TableCell>
              <TableCell>{t('tireCostPer1000')}</TableCell>
              {canWrite && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {mounted
              .slice()
              .sort((a, b) => positions.indexOf(a.position) - positions.indexOf(b.position))
              .map((tire) => {
                const perKm = tireCostPerKm(tire, odometer);
                return (
                  <TableRow key={tire.id}>
                    <TableCell>{t(`tirePosition_${tire.position}`)}</TableCell>
                    <TableCell>
                      {[tire.brand, tire.model].filter(Boolean).join(' ') || '—'}
                      {tire.size && (
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          component="div"
                          dir="ltr"
                        >
                          {tire.size}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell className={classes.number}>
                      {formatTime(tire.installed_at, 'date')}
                      {tire.installed_odometer != null &&
                        ` · ${Number(tire.installed_odometer).toLocaleString()} ${t('sharedKm')}`}
                    </TableCell>
                    <TableCell className={classes.number}>
                      {perKm == null ? '—' : money(perKm * 1000)}
                    </TableCell>
                    {canWrite && (
                      <TableCell align="right">
                        <Button size="small" onClick={() => setDialog({ type: 'tire', tire })}>
                          {t('tireReplace')}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      ) : (
        <Typography variant="body2" color="textSecondary">
          {t('tiresNone')}
        </Typography>
      )}
      {dialog?.type === 'tire' && (
        <TireDialog
          tire={dialog.tire}
          positions={dialog.tire ? positions : free}
          odometer={odometer}
          onClose={() => setDialog(null)}
          onSave={save}
        />
      )}
      {dialog?.type === 'tread' && (
        <TreadDialog onClose={() => setDialog(null)} onSave={saveTread} />
      )}
    </Paper>
  );
};

export default TiresSection;
