import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from '../settings/components/SettingsMenu';
import FleetDocumentsSection from '../settings/components/FleetDocumentsSection';
import FleetFieldsSection from './components/FleetFieldsSection';
import GovRegistryButton from './components/GovRegistryButton';
import { useCatch } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { formatTime } from '../common/util/formatter';
import { vehicleExpiryFields, vehicleFields } from '../common/fleet/fleetFields';
import {
  MAINTENANCE_TEMPLATES,
  SETUP_STEPS,
  maintenanceName,
  maintenancePayload,
} from '../common/fleet/vehicleSetup';
import { getFleetClient, unwrap } from '../common/fleet/client';
import { saveFleetRecord, useFleetAccess } from './fleetRecords';
import { ensureDriver, ensureVehicle } from './fleetData';
import { saveTraccarDevice, setOdometer } from '../admin/adminApi';
import { devicesActions, maintenancesActions } from '../store';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(0, 3, 3),
    maxWidth: 820,
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  card: {
    padding: theme.spacing(2.5),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  live: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
  },
  liveDone: {
    color: theme.palette.success.main,
  },
  nav: {
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  summary: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    '& li': {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    },
  },
}));

const capital = (value) => value.replace(/^\w/, (c) => c.toUpperCase());

// Step 1: the device, then a live "waiting for the first report…" until it reports.
const DeviceStep = ({ device, form, setForm }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const position = useSelector((state) => (device ? state.session.positions[device.id] : null));
  const live = useSelector((state) => (device ? state.devices.items[device.id] : null));
  const reported = Boolean(position) || live?.status === 'online';

  return (
    <>
      <TextField
        label={t('sharedName')}
        helperText={t('deviceNameHelp')}
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
        disabled={Boolean(device)}
      />
      <TextField
        label={t('deviceIdentifier')}
        helperText={t('vehicleWizardImeiHelp')}
        value={form.uniqueId}
        onChange={(event) => setForm({ ...form, uniqueId: event.target.value.trim() })}
        disabled={Boolean(device)}
        slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
      />
      {device && (
        <div className={classes.live} role="status">
          {reported ? (
            <CheckCircleRoundedIcon className={classes.liveDone} />
          ) : (
            <CircularProgress size={20} aria-hidden />
          )}
          <Typography variant="body2" className={cx(reported && classes.liveDone)}>
            {reported
              ? t('vehicleWizardReported').replace(
                  '{0}',
                  formatTime(position?.fixTime || live?.lastUpdate, 'minutes'),
                )
              : t('vehicleWizardWaiting')}
          </Typography>
        </div>
      )}
      {device && !reported && (
        <Typography variant="body2" color="textSecondary">
          {t('vehicleWizardWaitingHelp')}
        </Typography>
      )}
    </>
  );
};

// /fleet/vehicle/new (ADM-12): a new vehicle in six steps. Device (with a live wait for the first
// report), vehicle details (from the government registry), validity dates and scans, the regular
// driver, a maintenance plan from templates, and a summary. Each step saves as it goes, so
// leaving half way keeps what was done.
const VehicleWizardPage = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const fleet = useFleetAccess('vehicle');
  const drivers = useSelector((state) => state.drivers.items);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', uniqueId: '' });
  const [device, setDevice] = useState(null);
  const [driverId, setDriverId] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [plans, setPlans] = useState(['service']);
  const [done, setDone] = useState({});

  const setAttributes = (attributes) => setDevice({ ...device, attributes });
  const mark = (key, value = true) => setDone((current) => ({ ...current, [key]: value }));

  const saveDevice = async () => {
    const saved = await saveTraccarDevice(device);
    dispatch(devicesActions.update([saved]));
    setDevice(saved);
    if (fleet.write) {
      await saveFleetRecord('vehicle', saved, fleet.profile, { withDocuments: fleet.documents });
    }
    return saved;
  };

  const steps = {
    device: async () => {
      if (!device) {
        const saved = await saveTraccarDevice({ name: form.name.trim(), uniqueId: form.uniqueId });
        dispatch(devicesActions.update([saved]));
        setDevice(saved);
        mark('device');
        return false; // stay to watch for the first report
      }
      return true;
    },
    vehicle: async () => {
      await saveDevice();
      mark('vehicle');
      return true;
    },
    validity: async () => {
      await saveDevice();
      mark('validity');
      return true;
    },
    driver: async () => {
      if (driverId) {
        const driver = Object.values(drivers).find((item) => String(item.id) === driverId);
        await fetchOrThrow('api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: device.id, driverId: driver.id }),
        });
        if (fleet.write) {
          const client = getFleetClient();
          const now = new Date().toISOString();
          const driverRowId = await ensureDriver(driver, fleet.profile);
          const vehicleRowId = await ensureVehicle(device, fleet.profile);
          unwrap(
            await client
              .from('vehicle_driver_assignments')
              .update({ ends_at: now })
              .eq('driver_id', driverRowId)
              .or(`ends_at.is.null,ends_at.gt.${now}`),
          );
          unwrap(
            await client.from('vehicle_driver_assignments').insert({
              org_id: fleet.profile.org_id,
              vehicle_id: vehicleRowId,
              driver_id: driverRowId,
              starts_at: now,
              is_primary: true,
              created_by: fleet.profile.id,
            }),
          );
        }
        mark('driver', driver.name);
      }
      return true;
    },
    maintenance: async () => {
      if (odometerKm !== '') {
        await setOdometer(device.id, Number(odometerKm));
      }
      const created = [];
      for (const id of plans) {
        const template = MAINTENANCE_TEMPLATES.find((item) => item.id === id);
        const payload = maintenancePayload(
          template,
          maintenanceName(t(`vehicleWizardPlan${capital(id)}`), device.name),
          odometerKm,
        );
        const response = await fetchOrThrow('api/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const maintenance = await response.json();
        await fetchOrThrow('api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: device.id, maintenanceId: maintenance.id }),
        });
        created.push(maintenance);
      }
      if (created.length) {
        dispatch(maintenancesActions.update(created));
        mark('maintenance', created.length);
      }
      return true;
    },
  };

  const next = useCatch(async () => {
    setBusy(true);
    try {
      const key = SETUP_STEPS[step];
      if (await steps[key]()) {
        setStep(step + 1);
      }
    } finally {
      setBusy(false);
    }
  });

  const key = SETUP_STEPS[step];
  const stepValid = key !== 'device' || device || (form.name.trim() && form.uniqueId);

  const body = () => {
    switch (key) {
      case 'device':
        return <DeviceStep device={device} form={form} setForm={setForm} />;
      case 'vehicle':
        return (
          <FleetFieldsSection
            title={t('fleetVehicleDetails')}
            icon={<DirectionsCarRoundedIcon />}
            fields={vehicleFields}
            attributes={device.attributes}
            setAttributes={setAttributes}
            actions={
              <GovRegistryButton attributes={device.attributes} setAttributes={setAttributes} />
            }
          />
        );
      case 'validity':
        return (
          <>
            <FleetFieldsSection
              title={t('fleetVehicleValidity')}
              description={t('fleetExpiryHint')}
              icon={<EventAvailableRoundedIcon />}
              fields={vehicleExpiryFields}
              attributes={device.attributes}
              setAttributes={setAttributes}
              showExpiry
            />
            {fleet.documents && (
              <FleetDocumentsSection
                entity="vehicle"
                traccarId={device.id}
                name={device.name}
                identifier={device.uniqueId}
              />
            )}
          </>
        );
      case 'driver':
        return (
          <TextField
            select
            label={t('vehicleWizardDriver')}
            helperText={t('vehicleWizardDriverHelp')}
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          >
            <MenuItem value="">{t('vehicleWizardNoDriver')}</MenuItem>
            {Object.values(drivers)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((driver) => (
                <MenuItem key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </MenuItem>
              ))}
          </TextField>
        );
      case 'maintenance':
        return (
          <>
            <TextField
              type="number"
              label={t('vehicleWizardOdometer')}
              helperText={t('vehicleWizardOdometerHelp')}
              value={odometerKm}
              onChange={(event) => setOdometerKm(event.target.value)}
              slotProps={{ htmlInput: { dir: 'ltr', min: 0 } }}
            />
            <div role="group" aria-label={t('vehicleWizardPlans')}>
              {MAINTENANCE_TEMPLATES.map((template) => (
                <div key={template.id}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={plans.includes(template.id)}
                        onChange={(event) =>
                          setPlans(
                            event.target.checked
                              ? [...plans, template.id]
                              : plans.filter((id) => id !== template.id),
                          )
                        }
                      />
                    }
                    label={t(`vehicleWizardPlan${capital(template.id)}`)}
                  />
                </div>
              ))}
            </div>
          </>
        );
      default:
        return (
          <ul className={classes.summary}>
            {['device', 'vehicle', 'validity', 'driver', 'maintenance'].map((item) => (
              <li key={item}>
                {done[item] ? (
                  <CheckCircleRoundedIcon color="success" fontSize="small" />
                ) : (
                  <RemoveCircleOutlineRoundedIcon color="disabled" fontSize="small" />
                )}
                <Typography variant="body2">
                  {t(`vehicleWizardStep${capital(item)}`)}
                  {item === 'driver' && done.driver && ` · ${done.driver}`}
                  {!done[item] && ` · ${t('vehicleWizardSkipped')}`}
                </Typography>
              </li>
            ))}
          </ul>
        );
    }
  };

  const nextLabel = () => {
    if (key === 'device' && !device) return t('vehicleWizardCreate');
    if (key === 'driver' && !driverId) return t('vehicleWizardSkip');
    if (key === 'maintenance' && !plans.length && odometerKm === '') return t('vehicleWizardSkip');
    return t('setupContinue');
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={['fleetTitle', 'deviceTitle']}
      title={t('vehicleWizardTitle')}
      description={t('vehicleWizardDescription')}
    >
      <div className={classes.root}>
        {desktop ? (
          <Stepper activeStep={step} alternativeLabel>
            {SETUP_STEPS.map((item) => (
              <Step key={item} completed={Boolean(done[item]) || step > SETUP_STEPS.indexOf(item)}>
                <StepLabel>{t(`vehicleWizardStep${capital(item)}`)}</StepLabel>
              </Step>
            ))}
          </Stepper>
        ) : (
          <>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('vehicleWizardStepOf')
                .replace('{0}', step + 1)
                .replace('{1}', SETUP_STEPS.length)}
              {' · '}
              {t(`vehicleWizardStep${capital(key)}`)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((step + 1) / SETUP_STEPS.length) * 100}
              aria-label={t('vehicleWizardTitle')}
            />
          </>
        )}

        {!fleet.write && key !== 'device' && key !== 'summary' && (
          <Alert severity="info">{t('vehicleWizardNoFleet')}</Alert>
        )}

        <Paper elevation={0} className={classes.card}>
          {body()}
        </Paper>

        <div className={classes.nav}>
          {key === 'summary' ? (
            <>
              <Button variant="contained" component={RouterLink} to={`/fleet/vehicle/${device.id}`}>
                {t('vehicleWizardOpenCard')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setStep(0);
                  setDevice(null);
                  setForm({ name: '', uniqueId: '' });
                  setDriverId('');
                  setOdometerKm('');
                  setPlans(['service']);
                  setDone({});
                }}
              >
                {t('vehicleWizardAnother')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}
                disabled={busy}
              >
                {t(step === 0 ? 'sharedCancel' : 'a11yBack')}
              </Button>
              <Button variant="contained" onClick={next} disabled={busy || !stepValid}>
                {nextLabel()}
              </Button>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default VehicleWizardPage;
