import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import TireRepairRoundedIcon from '@mui/icons-material/TireRepairRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useTranslation } from '../LocalizationProvider';
import usePositionAttributes from '../../attributes/usePositionAttributes';
import { useDeviceReadonly } from '../../util/permissions';
import { useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../util/fetchOrThrow';
import { devicesActions } from '../../../store';
import { consumed } from './telemetryCatalog';
import ParameterDialog from './ParameterDialog';
import TirePressure, { pressureUnitKey } from './TirePressure';
import {
  PROFILE_KEY,
  compactProfile,
  detectWheels,
  fuelReading,
  isNumber,
  parseProfile,
  pressureUnits,
  tireReading,
  wheels,
} from './vehicleProfile';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(2)} !important`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  preview: {
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  sectionLabel: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  params: {
    display: 'flex',
    flexDirection: 'column',
  },
  param: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingBlock: theme.spacing(0.75),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
  },
  paramText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  paramName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  paramMeta: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}));

const toNumber = (text) => (text === '' || text == null ? null : Number(text));

const formatRaw = (value) =>
  isNumber(value)
    ? String(Number(value.toFixed(3)))
    : typeof value === 'object'
      ? '{…}'
      : String(value);

// Every value a position carries that the dashboard can show.
export const parameterKeys = (position) =>
  [
    ...Object.keys(position || {}).filter((key) => key !== 'attributes'),
    ...Object.keys(position?.attributes || {}).filter((key) => !Object.hasOwn(position, key)),
  ].filter((key) => {
    const value = Object.hasOwn(position, key) ? position[key] : position.attributes[key];
    return (key === 'rpm' || !consumed.has(key)) && value != null && value !== '';
  });

const rawValue = (position, key) =>
  Object.hasOwn(position, key) ? position[key] : position?.attributes?.[key];

const AttributeSelect = ({ label, value, onChange, options, emptyLabel }) => (
  <TextField
    select
    label={label}
    value={value || ''}
    onChange={(e) => onChange(e.target.value || null)}
    slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
  >
    <MenuItem value="">{emptyLabel}</MenuItem>
    {options.map((option) => (
      <MenuItem key={option.key} value={option.key}>
        {option.label}
      </MenuItem>
    ))}
  </TextField>
);

const VehicleSettingsDialog = ({ open, tab: initialTab, device, position, onClose, onSave }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const positionAttributes = usePositionAttributes(t);

  const [tab, setTab] = useState('fuel');
  const [capacity, setCapacity] = useState('');
  const [profile, setProfile] = useState({});
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab || 'fuel');
      setCapacity(device?.attributes?.fuelCapacity ?? '');
      setProfile(parseProfile(device));
    }
    // Load the device once per opening; live updates must not reset the draft.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [open, initialTab]);

  const labelOf = (key) => profile.params?.[key]?.label || positionAttributes[key]?.name || key;

  const numericOptions = useMemo(
    () =>
      Object.keys(position?.attributes || {})
        .filter((key) => isNumber(position.attributes[key]))
        .map((key) => ({
          key,
          label: `${positionAttributes[key]?.name || key} · ${formatRaw(position.attributes[key])}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [position, positionAttributes],
  );

  const capacityValue = toNumber(capacity);
  const draftDevice = {
    ...device,
    attributes: { ...device?.attributes, fuelCapacity: capacityValue > 0 ? capacityValue : null },
  };
  const fuel = position ? fuelReading(position, draftDevice, profile) : null;
  const tires = position
    ? tireReading(position, draftDevice, { ...profile, tires: { ...profile.tires, show: 'on' } })
    : null;
  const detected = position ? detectWheels(position) : {};

  const setFuel = (changes) => setProfile({ ...profile, fuel: { ...profile.fuel, ...changes } });
  const setTires = (changes) => setProfile({ ...profile, tires: { ...profile.tires, ...changes } });
  const setWheel = (wheel, key) => setTires({ wheels: { ...profile.tires?.wheels, [wheel]: key } });
  const setParam = (key, config) => {
    const params = { ...profile.params };
    if (config) params[key] = config;
    else delete params[key];
    setProfile({ ...profile, params });
  };

  const valid = capacity === '' || (Number.isFinite(capacityValue) && capacityValue >= 0);

  const wheelOrder = theme.direction === 'rtl' ? ['fr', 'fl', 'rr', 'rl'] : wheels;
  const wheelLabel = {
    fl: t('tireFrontLeft'),
    fr: t('tireFrontRight'),
    rl: t('tireRearLeft'),
    rr: t('tireRearRight'),
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
        <DialogTitle>
          {t('vehicleSettings')}
          {device?.name && (
            <Typography variant="body2" color="textSecondary" component="div">
              {device.name}
            </Typography>
          )}
        </DialogTitle>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
          <Tab
            value="fuel"
            icon={<LocalGasStationRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={t('vehicleFuelTab')}
          />
          <Tab
            value="tires"
            icon={<TireRepairRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={t('vehicleTiresTab')}
          />
          <Tab
            value="params"
            icon={<TuneRoundedIcon fontSize="small" />}
            iconPosition="start"
            label={t('vehicleParamsTab')}
          />
        </Tabs>
        <DialogContent className={classes.content}>
          {tab === 'fuel' && (
            <>
              <TextField
                type="number"
                label={t('attributeFuelCapacity')}
                helperText={t('vehicleFuelCapacityHelp')}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                error={!valid}
                slotProps={{ htmlInput: { min: 0, step: 'any', dir: 'ltr' } }}
              />
              <div className={classes.grid}>
                <AttributeSelect
                  label={t('vehicleFuelSource')}
                  value={profile.fuel?.source}
                  onChange={(source) => setFuel({ source })}
                  options={numericOptions}
                  emptyLabel={t('vehicleAuto')}
                />
                <TextField
                  select
                  label={t('vehicleFuelUnit')}
                  value={profile.fuel?.unit || 'auto'}
                  onChange={(e) => setFuel({ unit: e.target.value })}
                >
                  <MenuItem value="auto">{t('vehicleAuto')}</MenuItem>
                  <MenuItem value="liters">{t('vehicleFuelLiters')}</MenuItem>
                  <MenuItem value="percent">{t('vehicleFuelPercent')}</MenuItem>
                </TextField>
              </div>
              <Typography variant="body2" color="textSecondary">
                {t('vehicleFuelExplain')}
              </Typography>
              <div className={classes.preview}>
                {fuel
                  ? [
                      `${Math.round(fuel.ratio * 100)}%`,
                      fuel.liters != null &&
                        [
                          `${fuel.liters.toFixed(1)} ${t('vehicleLitersShort')}`,
                          fuel.capacity != null &&
                            `${t('vehicleOf')} ${fuel.capacity} ${t('vehicleLitersShort')}`,
                        ]
                          .filter(Boolean)
                          .join(' '),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : t('vehicleFuelNoReading')}
              </div>
            </>
          )}

          {tab === 'tires' && (
            <>
              <TextField
                select
                label={t('vehicleTiresShow')}
                value={profile.tires?.show || 'auto'}
                onChange={(e) => setTires({ show: e.target.value })}
              >
                <MenuItem value="auto">{t('vehicleTiresShowAuto')}</MenuItem>
                <MenuItem value="on">{t('vehicleTiresShowOn')}</MenuItem>
                <MenuItem value="off">{t('vehicleTiresShowOff')}</MenuItem>
              </TextField>
              <span className={classes.sectionLabel}>{t('vehicleTiresMapping')}</span>
              <div className={classes.grid}>
                {wheelOrder.map((wheel) => (
                  <AttributeSelect
                    key={wheel}
                    label={wheelLabel[wheel]}
                    value={profile.tires?.wheels?.[wheel]}
                    onChange={(key) => setWheel(wheel, key)}
                    options={numericOptions}
                    emptyLabel={
                      detected[wheel]
                        ? `${t('vehicleAuto')} (${positionAttributes[detected[wheel]]?.name || detected[wheel]})`
                        : t('vehicleNone')
                    }
                  />
                ))}
              </div>
              <div className={classes.grid}>
                <TextField
                  select
                  label={t('vehicleTiresInput')}
                  value={profile.tires?.input || 'auto'}
                  onChange={(e) => setTires({ input: e.target.value })}
                >
                  <MenuItem value="auto">{t('vehicleAuto')}</MenuItem>
                  {pressureUnits.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {t(pressureUnitKey(unit))}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label={t('vehicleTiresUnit')}
                  value={profile.tires?.unit || 'bar'}
                  onChange={(e) => setTires({ unit: e.target.value })}
                >
                  {pressureUnits.map((unit) => (
                    <MenuItem key={unit} value={unit}>
                      {t(pressureUnitKey(unit))}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  type="number"
                  label={t('vehicleTiresTarget')}
                  value={profile.tires?.target ?? ''}
                  onChange={(e) => setTires({ target: toNumber(e.target.value) })}
                  slotProps={{ htmlInput: { min: 0, step: 'any', dir: 'ltr' } }}
                />
                <TextField
                  type="number"
                  label={t('vehicleTiresMin')}
                  value={profile.tires?.min ?? ''}
                  onChange={(e) => setTires({ min: toNumber(e.target.value) })}
                  slotProps={{ htmlInput: { min: 0, step: 'any', dir: 'ltr' } }}
                />
              </div>
              <Typography variant="body2" color="textSecondary">
                {t('vehicleTiresExplain')}
              </Typography>
              {tires && <TirePressure reading={tires} />}
            </>
          )}

          {tab === 'params' && (
            <>
              <Typography variant="body2" color="textSecondary">
                {t('vehicleParamsExplain')}
              </Typography>
              <div className={classes.params}>
                {parameterKeys(position).map((key) => {
                  const config = profile.params?.[key];
                  return (
                    <div key={key} className={classes.param}>
                      <div className={classes.paramText}>
                        <span className={classes.paramName}>{labelOf(key)}</span>
                        <span
                          className={classes.paramMeta}
                          dir="ltr"
                          style={{ textAlign: theme.direction === 'rtl' ? 'right' : 'left' }}
                        >
                          {key} = {formatRaw(rawValue(position, key))}
                          {config?.unit ? ` ${config.unit}` : ''}
                        </span>
                      </div>
                      <Switch
                        checked={!config?.hidden}
                        onChange={(e) =>
                          setParam(key, { ...config, hidden: !e.target.checked || null })
                        }
                        slotProps={{ input: { 'aria-label': t('parameterVisible') } }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => setEditing(key)}
                        aria-label={t('parameterEdit')}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="inherit" onClick={onClose}>
            {t('sharedCancel')}
          </Button>
          <Button
            variant="contained"
            disabled={!valid}
            onClick={() =>
              onSave(compactProfile(profile), capacityValue > 0 ? capacityValue : null)
            }
          >
            {t('sharedSave')}
          </Button>
        </DialogActions>
      </Dialog>
      <ParameterDialog
        open={Boolean(editing)}
        paramKey={editing}
        defaultLabel={editing ? positionAttributes[editing]?.name || editing : ''}
        value={editing ? rawValue(position, editing) : null}
        config={editing ? profile.params?.[editing] : null}
        onClose={() => setEditing(null)}
        onApply={(config) => {
          setParam(editing, config);
          setEditing(null);
        }}
      />
    </>
  );
};

// Opens the vehicle settings or a single parameter's settings and saves them on
// the device. `open` is null when the user cannot edit the device.
export const useVehicleSettings = (device, position) => {
  const t = useTranslation();
  const dispatch = useDispatch();
  const readonly = useDeviceReadonly();
  const positionAttributes = usePositionAttributes(t);
  const [state, setState] = useState(null);

  const save = useCatch(async (profile, fuelCapacity) => {
    const attributes = { ...device.attributes };
    if (Object.keys(profile).length) attributes[PROFILE_KEY] = JSON.stringify(profile);
    else delete attributes[PROFILE_KEY];
    if (fuelCapacity !== undefined) {
      if (fuelCapacity > 0) attributes.fuelCapacity = fuelCapacity;
      else delete attributes.fuelCapacity;
    }
    const response = await fetchOrThrow(`api/devices/${device.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...device, attributes }),
    });
    dispatch(devicesActions.update([await response.json()]));
    setState(null);
  });

  const canEdit = Boolean(device?.id) && !readonly;
  const profile = useMemo(() => parseProfile(device), [device]);
  const paramKey = state?.param;

  const element = canEdit ? (
    <>
      <VehicleSettingsDialog
        open={state?.type === 'settings'}
        tab={state?.tab}
        device={device}
        position={position}
        onClose={() => setState(null)}
        onSave={save}
      />
      <ParameterDialog
        open={state?.type === 'param'}
        paramKey={paramKey}
        defaultLabel={paramKey ? positionAttributes[paramKey]?.name || paramKey : ''}
        value={paramKey && position ? rawValue(position, paramKey) : null}
        config={paramKey ? profile.params?.[paramKey] : null}
        onClose={() => setState(null)}
        onApply={(config) => {
          const params = { ...profile.params };
          if (config) params[paramKey] = config;
          else delete params[paramKey];
          save(compactProfile({ ...profile, params }), undefined);
        }}
      />
    </>
  ) : null;

  return {
    canEdit,
    element,
    openSettings: canEdit ? (tab) => setState({ type: 'settings', tab }) : null,
    openParameter: canEdit ? (param) => setState({ type: 'param', param }) : null,
  };
};

export default VehicleSettingsDialog;
