import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Button,
  FormControlLabel,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import RouterRoundedIcon from '@mui/icons-material/RouterRounded';
import SimCardRoundedIcon from '@mui/icons-material/SimCardRounded';
import StoreRoundedIcon from '@mui/icons-material/StoreRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import SettingsSuggestRoundedIcon from '@mui/icons-material/SettingsSuggestRounded';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAsyncTask, useCatch } from '../reactHelper';
import deviceCategories from '../common/util/deviceCategories';
import SelectField from '../common/components/SelectField';
import FormPage from '../settings/components/FormPage';
import FormSection from '../settings/components/FormSection';
import SaveBar from '../settings/components/SaveBar';
import {
  PROFILE_KEY,
  compactProfile,
  parseProfile,
} from '../common/components/telemetry/vehicleProfile';
import AdminMenu from './components/AdminMenu';
import AdminGate from './components/AdminGate';
import CustomerSelect from './components/CustomerSelect';
import SensorsEditor, { sensorTitleKey } from './components/SensorsEditor';
import { useAdminAccess, useAdminDirectory } from './useAdmin';
import {
  applySensors,
  computedForSensors,
  sensorFuelCapacity,
  sensorProblem,
  sensorsFromProfile,
} from './sensors';
import {
  assignDevices,
  getJson,
  saveRegistry,
  saveTraccarDevice,
  setOdometer,
  syncComputedAttributes,
} from './adminApi';

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  wide: {
    gridColumn: '1 / -1',
  },
  hint: {
    padding: theme.spacing(1.25, 1.75),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  code: {
    fontFamily: theme.typography.fontFamily,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
}));

// Common trackers and the Traccar protocol port they report to.
const deviceModels = [
  { model: 'Teltonika FMB920', protocol: 'teltonika', port: 5027 },
  { model: 'Teltonika FMB003', protocol: 'teltonika', port: 5027 },
  { model: 'Teltonika FMC130', protocol: 'teltonika', port: 5027 },
  { model: 'Teltonika FMB140', protocol: 'teltonika', port: 5027 },
  { model: 'Teltonika FMC650', protocol: 'teltonika', port: 5027 },
  { model: 'Queclink GV300', protocol: 'gl200', port: 5004 },
  { model: 'Concox GT06N', protocol: 'gt06', port: 5023 },
  { model: 'Ruptela FM-Eco4', protocol: 'ruptela', port: 5046 },
  { model: 'Meitrack T366', protocol: 'meitrack', port: 5020 },
  { model: 'Coban TK103', protocol: 'gps103', port: 5001 },
  { model: 'Traccar Client (OsmAnd)', protocol: 'osmand', port: 5055 },
];

const simProviders = [
  'Pelephone',
  'Cellcom',
  'Partner',
  'HOT mobile',
  'Golan Telecom',
  '019 Mobile',
  'We4G',
];

const KNOTS_PER_KMH = 1 / 1.852;

const registryFields = [
  'device_model',
  'sim_provider',
  'iccid',
  'installed_at',
  'installer',
  'billable',
  'notes',
];

const DeviceSetupPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const deviceId = id ? Number(id) : null;

  const access = useAdminAccess();
  const directory = useAdminDirectory();

  const [device, setDevice] = useState(null);
  const [position, setPosition] = useState(null);
  const [sensors, setSensors] = useState([]);
  const [registry, setRegistry] = useState({ billable: true });
  const [customerId, setCustomerId] = useState(null);
  const [speedLimit, setSpeedLimit] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [registryLoaded, setRegistryLoaded] = useState(false);

  useAsyncTask(
    async ({ signal }) => {
      if (!deviceId) {
        setDevice({ name: '', uniqueId: '', category: 'car', attributes: {} });
        return;
      }
      const loaded = await getJson(`api/devices/${deviceId}`, signal);
      setDevice(loaded);
      setSensors(sensorsFromProfile(parseProfile(loaded)));
      const limit = Number(loaded.attributes?.speedLimit);
      setSpeedLimit(limit > 0 ? String(Math.round(limit / KNOTS_PER_KMH)) : '');
      const positions = await getJson(`api/positions?deviceId=${deviceId}`, signal);
      setPosition(positions[0] || null);
    },
    [deviceId],
  );

  // The registry row arrives with the directory; copy it into the form once.
  const directoryLoaded = directory.loaded;
  const registryRow = deviceId ? directory.deviceOwner.get(deviceId) : null;
  const deviceModel = device?.model;
  const deviceReady = !deviceId || Boolean(device);
  useEffect(() => {
    if (!directoryLoaded || registryLoaded || !deviceReady) return;
    if (registryRow) {
      setRegistry(registryRow);
      setCustomerId(registryRow.customer_id);
    } else if (deviceModel) {
      setRegistry({ billable: true, device_model: deviceModel });
    }
    setRegistryLoaded(true);
  }, [directoryLoaded, registryLoaded, deviceReady, registryRow, deviceModel]);

  const model = deviceModels.find((it) => it.model === (registry.device_model || device?.model));
  const problems = sensors.map(sensorProblem).filter(Boolean);
  const valid = device && device.name?.trim() && device.uniqueId?.trim() && !problems.length;

  const categories = useMemo(
    () =>
      deviceCategories
        .map((category) => ({
          id: category,
          name: t(`category${category.replace(/^\w/, (c) => c.toUpperCase())}`),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [t],
  );

  const handleSave = useCatch(async () => {
    setSaving(true);
    try {
      const profile = compactProfile(
        applySensors(parseProfile(device), sensors, (sensor) => t(sensorTitleKey(sensor.type))),
      );
      const attributes = { ...device.attributes };
      if (Object.keys(profile).length) attributes[PROFILE_KEY] = JSON.stringify(profile);
      else delete attributes[PROFILE_KEY];
      const capacity = sensorFuelCapacity(sensors);
      if (capacity) attributes.fuelCapacity = capacity;
      const limit = Number(speedLimit);
      if (limit > 0) attributes.speedLimit = Number((limit * KNOTS_PER_KMH).toFixed(2));
      else delete attributes.speedLimit;

      const saved = await saveTraccarDevice({
        ...device,
        name: device.name.trim(),
        uniqueId: device.uniqueId.trim(),
        model: registry.device_model || device.model || null,
        attributes,
      });

      await syncComputedAttributes(saved.id, computedForSensors(sensors, saved.id));
      if (odometerKm !== '' && Number(odometerKm) >= 0) {
        await setOdometer(saved.id, Number(odometerKm));
      }
      if (access.customersManage) {
        const previous = directory.deviceOwner.get(saved.id)?.customer_id ?? null;
        if (previous !== customerId || !directory.deviceOwner.has(saved.id)) {
          await assignDevices([saved.id], customerId);
        }
        const row = { traccar_device_id: saved.id, sim_number: saved.phone || null };
        registryFields.forEach((key) => {
          row[key] = registry[key] === '' ? null : (registry[key] ?? null);
        });
        row.billable = registry.billable !== false;
        await saveRegistry(row);
      }
      navigate('/admin/devices');
    } finally {
      setSaving(false);
    }
  });

  const setField = (key) => (event) => setDevice({ ...device, [key]: event.target.value });
  const setReg = (key, value) => setRegistry({ ...registry, [key]: value });
  const currentKm = position?.attributes?.totalDistance
    ? Math.round(position.attributes.totalDistance / 1000)
    : null;

  return (
    <FormPage
      menu={<AdminMenu />}
      breadcrumbs={['adminTitle', 'adminDevices']}
      title={deviceId ? device?.name || t('adminDeviceSetup') : t('adminNewDevice')}
      description={t('adminDeviceSetupDescription')}
      maxWidth={880}
      footer={
        <SaveBar
          onCancel={() => navigate(-1)}
          onSave={handleSave}
          saving={saving}
          disabled={!valid}
        />
      }
    >
      {!device ? (
        <FormSection title={<Skeleton width="10em" />}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={-i} variant="rounded" height={40} />
          ))}
        </FormSection>
      ) : (
        <>
          <FormSection
            icon={<RouterRoundedIcon />}
            title={`1. ${t('adminStepDevice')}`}
            description={t('adminStepDeviceHelp')}
          >
            <div className={classes.grid}>
              <TextField
                required
                label={t('adminDeviceName')}
                placeholder={t('adminDeviceNamePlaceholder')}
                value={device.name || ''}
                onChange={setField('name')}
              />
              <TextField
                required
                label={t('adminImei')}
                helperText={t('adminImeiHelp')}
                value={device.uniqueId || ''}
                onChange={setField('uniqueId')}
                slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
              />
              <Autocomplete
                freeSolo
                autoSelect
                options={deviceModels.map((it) => it.model)}
                value={registry.device_model || device.model || ''}
                onChange={(_, value) => setReg('device_model', value || '')}
                renderInput={(params) => <TextField {...params} label={t('deviceModel')} />}
              />
              <SelectField
                value={device.category || 'default'}
                onChange={(event) => setDevice({ ...device, category: event.target.value })}
                data={categories}
                label={t('deviceCategory')}
              />
              <div className={classes.wide}>
                <SelectField
                  value={device.groupId}
                  onChange={(event) =>
                    setDevice({ ...device, groupId: Number(event.target.value) })
                  }
                  endpoint="api/groups"
                  label={t('groupParent')}
                />
              </div>
              {model && (
                <Typography variant="body2" className={`${classes.hint} ${classes.wide}`}>
                  {t('adminServerHint')}{' '}
                  <span className={classes.code} dir="ltr">
                    {`${window.location.hostname}:${model.port}`}
                  </span>{' '}
                  <span dir="ltr">{`(${model.protocol})`}</span>
                </Typography>
              )}
            </div>
          </FormSection>

          <FormSection icon={<SimCardRoundedIcon />} title={`2. ${t('adminStepSim')}`}>
            <div className={classes.grid}>
              <TextField
                label={t('adminSimNumber')}
                value={device.phone || ''}
                onChange={setField('phone')}
                slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'tel' } }}
              />
              <Autocomplete
                freeSolo
                autoSelect
                options={simProviders}
                value={registry.sim_provider || ''}
                onChange={(_, value) => setReg('sim_provider', value || '')}
                disabled={!access.customersManage}
                renderInput={(params) => <TextField {...params} label={t('adminSimProvider')} />}
              />
              <TextField
                className={classes.wide}
                label={t('adminIccid')}
                value={registry.iccid || ''}
                onChange={(event) => setReg('iccid', event.target.value)}
                disabled={!access.customersManage}
                slotProps={{ htmlInput: { dir: 'ltr' } }}
              />
            </div>
          </FormSection>

          <FormSection
            icon={<StoreRoundedIcon />}
            title={`3. ${t('adminStepCustomer')}`}
            description={t('adminStepCustomerHelp')}
          >
            <AdminGate need="customersManage" className="" />
            <div className={classes.grid}>
              <div className={classes.wide}>
                <CustomerSelect
                  customers={directory.customers}
                  value={customerId}
                  onChange={setCustomerId}
                  disabled={!access.customersManage}
                />
              </div>
              <TextField
                type="date"
                label={t('adminInstalledAt')}
                value={registry.installed_at || ''}
                onChange={(event) => setReg('installed_at', event.target.value)}
                disabled={!access.customersManage}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={t('adminInstaller')}
                value={registry.installer || ''}
                onChange={(event) => setReg('installer', event.target.value)}
                disabled={!access.customersManage}
              />
              <FormControlLabel
                className={classes.wide}
                control={
                  <Switch
                    checked={registry.billable !== false}
                    onChange={(event) => setReg('billable', event.target.checked)}
                    disabled={!access.customersManage}
                  />
                }
                label={t('adminBillable')}
              />
              <TextField
                className={classes.wide}
                multiline
                minRows={2}
                label={t('adminNotes')}
                value={registry.notes || ''}
                onChange={(event) => setReg('notes', event.target.value)}
                disabled={!access.customersManage}
              />
            </div>
          </FormSection>

          <FormSection icon={<DirectionsCarRoundedIcon />} title={`4. ${t('adminStepVehicle')}`}>
            <div className={classes.grid}>
              <TextField
                type="number"
                label={t('adminSpeedLimitKmh')}
                helperText={t('adminSpeedLimitHelp')}
                value={speedLimit}
                onChange={(event) => setSpeedLimit(event.target.value)}
              />
              <TextField
                type="number"
                label={t('adminOdometerKm')}
                helperText={
                  currentKm !== null
                    ? t('adminOdometerCurrent').replace('{0}', currentKm.toLocaleString())
                    : t('adminOdometerHelp')
                }
                value={odometerKm}
                onChange={(event) => setOdometerKm(event.target.value)}
              />
            </div>
          </FormSection>

          <FormSection
            icon={<SensorsRoundedIcon />}
            title={`5. ${t('adminStepSensors')}`}
            description={t('adminStepSensorsHelp')}
          >
            {deviceId && !position && <Alert severity="info">{t('adminSensorNoPosition')}</Alert>}
            <SensorsEditor sensors={sensors} onChange={setSensors} position={position} />
          </FormSection>

          {deviceId && (
            <FormSection
              icon={<SettingsSuggestRoundedIcon />}
              title={t('adminAdvanced')}
              description={t('adminAdvancedHelp')}
              actions={
                <Button
                  variant="outlined"
                  component={RouterLink}
                  to={`/settings/device/${deviceId}`}
                >
                  {t('adminOpenAdvanced')}
                </Button>
              }
            />
          )}
        </>
      )}
    </FormPage>
  );
};

export default DeviceSetupPage;
