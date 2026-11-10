import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import { DateTimeField } from '../common/components/pickers';
import MoneyField from '../common/components/MoneyField';
import { useCatch } from '../reactHelper';
import { useFleetProfile } from '../common/fleet/useFleet';
import { fromLocalInput, toLocalInput } from '../common/fleet/incidents';
import { enqueue, newId, sendItem, shrinkImage } from '../common/fleet/outbox';
import FleetNotice from './components/FleetNotice';
import DriverDoneCard from './components/DriverDoneCard';
import useDriverContext from './useDriverContext';
import './driverOutbox';

const useStyles = makeStyles()((theme) => ({
  root: {
    maxWidth: 480,
    margin: theme.spacing(2, 'auto'),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 2),
  },
  card: {
    padding: theme.spacing(2),
    borderRadius: theme.tokens.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  receipt: {
    width: '100%',
    maxHeight: 220,
    objectFit: 'contain',
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.sunken,
  },
}));

// ADM-18: "fueling / receipt" in the driver portal: the amount, the litres, the odometer and a
// photo of the receipt, on the vehicle assigned to the driver now. Without a line it waits in
// the phone (the outbox) like the damage report.
const DriverFuelPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const profile = useFleetProfile();
  const context = useDriverContext();
  const assignment = context?.assignment;
  const [form, setForm] = useState(() => ({
    occurred_at: toLocalInput(),
    total: '',
    liters: '',
    odometer: '',
    station: '',
  }));
  const [receipt, setReceipt] = useState(null);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [failed, setFailed] = useState(false);

  const preview = useMemo(() => (receipt ? URL.createObjectURL(receipt) : null), [receipt]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const number = (value) => (value === '' ? null : Number(value));

  const submit = useCatch(async () => {
    setSaving(true);
    setFailed(false);
    try {
      let item = pending;
      if (!item) {
        const files = receipt
          ? [await shrinkImage(receipt)].map((small) => ({
              blob: small,
              name: small.name,
              type: small.type,
              lastModified: receipt.lastModified,
            }))
          : [];
        item = await enqueue(
          'fuel',
          {
            fueling: {
              id: newId(),
              org_id: profile.org_id,
              occurred_at: fromLocalInput(form.occurred_at),
              total: Number(form.total),
              liters: number(form.liters),
              odometer: number(form.odometer),
              station: form.station.trim() || null,
            },
          },
          files,
          { ownerId: profile.id },
        );
        setPending(item);
      }
      const result = await sendItem(item);
      if (result.sent) {
        setDone({ time: new Date(), queued: false });
      } else if (result.error?.code || result.error?.statusCode) {
        // The database said no (e.g. no vehicle now): the driver sees it, it is not retried.
        setFailed(true);
      } else {
        setDone({ time: new Date(), queued: true });
      }
    } finally {
      setSaving(false);
    }
  });

  const content = () => {
    if (context === undefined) return null;
    if (!context.driver || !assignment) {
      return (
        <Alert severity="info">
          {t(context.driver ? 'driverNoVehicle' : 'fleetDriverPortalNotLinked')}
        </Alert>
      );
    }
    if (done) {
      return (
        <DriverDoneCard
          titleKey={done.queued ? 'driverFuelQueued' : 'driverFuelSent'}
          time={done.time}
          pending={done.queued}
        />
      );
    }
    return (
      <Paper elevation={0} className={classes.card}>
        <Typography variant="subtitle1" component="h2" fontWeight={700}>
          <span dir="ltr">{assignment.plate_number}</span>
        </Typography>
        {failed && <Alert severity="error">{t('driverFuelFailed')}</Alert>}
        <Button
          component="label"
          variant="outlined"
          startIcon={<PhotoCameraRoundedIcon />}
          disabled={Boolean(pending)}
        >
          {t(receipt ? 'driverFuelReceiptAgain' : 'driverFuelReceipt')}
          <input
            hidden
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              setReceipt(event.target.files?.[0] || null);
              event.target.value = '';
            }}
          />
        </Button>
        {preview && <img src={preview} alt={t('driverFuelReceipt')} className={classes.receipt} />}
        <MoneyField
          label={t('fleetFuelFieldTotal')}
          value={form.total}
          onChange={set('total')}
          required
          disabled={Boolean(pending)}
        />
        <TextField
          type="number"
          label={t('fleetFuelFieldLiters')}
          value={form.liters}
          onChange={set('liters')}
          disabled={Boolean(pending)}
          slotProps={{ htmlInput: { inputMode: 'decimal', min: 0, step: 0.01 } }}
        />
        <TextField
          type="number"
          label={t('fleetFuelFieldOdometerReported')}
          value={form.odometer}
          onChange={set('odometer')}
          disabled={Boolean(pending)}
          slotProps={{ htmlInput: { inputMode: 'numeric', min: 0 } }}
        />
        <TextField
          label={t('fleetFuelFieldStation')}
          value={form.station}
          onChange={set('station')}
          disabled={Boolean(pending)}
        />
        <DateTimeField
          label={t('fleetFuelFieldOccurredAt')}
          value={form.occurred_at}
          minuteStep={1}
          onChange={set('occurred_at')}
          disabled={Boolean(pending)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button
          variant="contained"
          size="large"
          onClick={submit}
          disabled={saving || !(Number(form.total) > 0) || !form.occurred_at}
        >
          {t('driverFuelSend')}
        </Button>
      </Paper>
    );
  };

  return (
    <PageLayout breadcrumbs={['fleetDriverPortal']} title={t('driverFuel')}>
      <FleetNotice permission="inspections.write" />
      <div className={classes.root}>{content()}</div>
    </PageLayout>
  );
};

export default DriverFuelPage;
