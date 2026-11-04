import { useMemo } from 'react';
import {
  Autocomplete,
  Button,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import SensorDoorRoundedIcon from '@mui/icons-material/SensorDoorRounded';
import SosRoundedIcon from '@mui/icons-material/SosRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import TireRepairRoundedIcon from '@mui/icons-material/TireRepairRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import usePositionAttributes from '../../common/attributes/usePositionAttributes';
import {
  analogInputs,
  createSensor,
  digitalInputs,
  fuelSources,
  fuelUnits,
  sensorProblem,
  sensorReading,
  sensorTypes,
  singleSensors,
  temperatureSources,
  voltageSources,
} from '../sensors';

export const sensorIcons = {
  ignition: KeyRoundedIcon,
  fuel: LocalGasStationRoundedIcon,
  temperature: DeviceThermostatRoundedIcon,
  door: SensorDoorRoundedIcon,
  panic: SosRoundedIcon,
  voltage: BoltRoundedIcon,
  tires: TireRepairRoundedIcon,
  custom: TuneRoundedIcon,
};

export const sensorTitleKey = (type) =>
  `adminSensor${type.charAt(0).toUpperCase()}${type.slice(1)}`;

const useStyles = makeStyles()((theme) => ({
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.75, 2),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
  },
  cardProblem: {
    borderColor: alpha(theme.palette.warning.main, 0.6),
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  icon: {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.primary.main,
    '& svg': {
      fontSize: 20,
    },
  },
  titles: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: 600,
  },
  live: {
    flexShrink: 0,
    padding: theme.spacing(0.25, 1.25),
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.surface.tint,
    color: theme.palette.surface.textSecondaryOnTint,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  liveValue: {
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  fields: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: theme.spacing(1.5),
  },
  calibration: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
  },
  calibrationHint: {
    gridColumn: '1 / -1',
    color: theme.palette.surface.textSecondaryOnTint,
  },
  problem: {
    color: theme.palette.warning.main,
    fontWeight: 600,
  },
  addGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: theme.spacing(1),
  },
  addTile: {
    justifyContent: 'flex-start',
    textAlign: 'start',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.tokens.radius.md,
    borderColor: theme.palette.surface.border,
    color: theme.palette.text.primary,
    '& .MuiButton-startIcon': {
      margin: 0,
      color: theme.palette.primary.main,
    },
    '& .MuiButton-endIcon': {
      marginInlineStart: 'auto',
      color: theme.palette.text.secondary,
    },
  },
  addText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  addTitle: {
    fontWeight: 600,
    lineHeight: 1.3,
  },
  addDescription: {
    color: theme.palette.text.secondary,
    fontWeight: 400,
    lineHeight: 1.35,
  },
  sectionLabel: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
}));

// Free-text attribute picker with friendly names for known keys.
const SourceField = ({ label, value, options, onChange, helperText }) => {
  const t = useTranslation();
  const positionAttributes = usePositionAttributes(t);
  const describe = (key) => {
    const match = key.match(/^(adc|in|temp)(\d)$/);
    if (match) {
      const kind = { adc: 'adminAnalogInput', in: 'adminDigitalInput', temp: 'adminTempProbe' }[
        match[1]
      ];
      return `${t(kind)} ${match[2]}`;
    }
    return positionAttributes[key]?.name || key;
  };
  return (
    <Autocomplete
      freeSolo
      autoSelect
      options={options}
      value={value || ''}
      onChange={(_, next) => onChange(next || '')}
      getOptionLabel={(option) => option}
      renderOption={({ key, ...props }, option) => (
        <li key={key} {...props}>
          <span>{describe(option)}</span>
          <Typography
            component="span"
            variant="caption"
            color="textSecondary"
            dir="ltr"
            style={{ marginInlineStart: 8 }}
          >
            {option}
          </Typography>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          helperText={helperText ?? (value ? describe(value) : undefined)}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps?.htmlInput, dir: 'ltr' },
          }}
        />
      )}
    />
  );
};

const InputSelect = ({ label, value, onChange, allowAuto }) => {
  const t = useTranslation();
  return (
    <TextField
      select
      label={label}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
    >
      {allowAuto && <MenuItem value="auto">{t('adminSensorFromDevice')}</MenuItem>}
      {digitalInputs.map((input) => (
        <MenuItem key={input} value={input}>
          {`${t('adminDigitalInput')} ${input.slice(2)}`}
        </MenuItem>
      ))}
    </TextField>
  );
};

const numberField = (value) => (value === null || value === undefined ? '' : value);
const toNumber = (text) => (text === '' ? '' : Number(text));

const formatLive = (value, t) => {
  if (value === undefined || value === null) return t('adminSensorNoReading');
  if (typeof value === 'boolean') return value ? t('adminSensorOn') : t('adminSensorOff');
  if (typeof value === 'number') return String(Number(value.toFixed(2)));
  return String(value);
};

// One sensor card: what it is, its wiring, and the value the device sends now.
const SensorCard = ({ sensor, position, positionKeys, onChange, onRemove }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const Icon = sensorIcons[sensor.type] || TuneRoundedIcon;
  const set = (changes) => onChange({ ...sensor, ...changes });
  const problem = sensorProblem(sensor);
  const live = sensorReading(sensor, position);
  const withKeys = (list) => [...new Set([...list, ...positionKeys])];

  let fields;
  switch (sensor.type) {
    case 'ignition':
      fields = (
        <div className={classes.fields}>
          <InputSelect
            label={t('adminSensorIgnitionSource')}
            value={sensor.input}
            onChange={(input) => set({ input })}
            allowAuto
          />
        </div>
      );
      break;
    case 'door':
    case 'panic':
      fields = (
        <div className={classes.fields}>
          <InputSelect
            label={t('adminSensorWire')}
            value={sensor.input}
            onChange={(input) => set({ input })}
          />
        </div>
      );
      break;
    case 'fuel':
      fields = (
        <>
          <div className={classes.fields}>
            <SourceField
              label={t('adminSensorSource')}
              value={sensor.source}
              options={withKeys(fuelSources)}
              onChange={(source) => set({ source })}
            />
            <TextField
              select
              label={t('adminSensorFuelReports')}
              value={sensor.unit || 'percent'}
              onChange={(event) => {
                const unit = event.target.value;
                const fromCan = ['fuelLevel', 'fuel'].includes(sensor.source);
                set(unit === 'raw' && fromCan ? { unit, source: 'adc1' } : { unit });
              }}
            >
              {fuelUnits.map((unit) => (
                <MenuItem key={unit} value={unit}>
                  {t(`adminFuelUnit${unit.charAt(0).toUpperCase()}${unit.slice(1)}`)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label={t('adminSensorTankLiters')}
              value={numberField(sensor.capacity)}
              onChange={(event) => set({ capacity: toNumber(event.target.value) })}
            />
          </div>
          {sensor.unit === 'raw' && (
            <div className={classes.calibration}>
              <Typography variant="body2" className={classes.calibrationHint}>
                {t('adminSensorCalibrationHelp')}
              </Typography>
              {['empty', 'full'].map((point) => {
                const raw = position
                  ? (position.attributes?.[sensor.source] ?? position[sensor.source])
                  : undefined;
                return (
                  <TextField
                    key={point}
                    type="number"
                    label={t(
                      point === 'empty' ? 'adminSensorEmptyReading' : 'adminSensorFullReading',
                    )}
                    value={numberField(sensor[point])}
                    onChange={(event) => set({ [point]: toNumber(event.target.value) })}
                    slotProps={{
                      input: {
                        endAdornment:
                          typeof raw === 'number' ? (
                            <Button size="small" onClick={() => set({ [point]: raw })}>
                              {t('adminSensorUseNow')}
                            </Button>
                          ) : null,
                      },
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      );
      break;
    case 'temperature':
    case 'voltage':
      fields = (
        <div className={classes.fields}>
          <TextField
            label={t('adminSensorName')}
            placeholder={t(
              sensor.type === 'temperature'
                ? 'adminSensorTempPlaceholder'
                : 'adminSensorVoltagePlaceholder',
            )}
            value={sensor.label || ''}
            onChange={(event) => set({ label: event.target.value })}
          />
          <SourceField
            label={t('adminSensorSource')}
            value={sensor.source}
            options={withKeys(sensor.type === 'temperature' ? temperatureSources : voltageSources)}
            onChange={(source) => set({ source })}
          />
        </div>
      );
      break;
    case 'tires':
      fields = (
        <div className={classes.fields}>
          <TextField
            select
            label={t('vehicleTiresShow')}
            value={sensor.show || 'on'}
            onChange={(event) => set({ show: event.target.value })}
          >
            <MenuItem value="on">{t('vehicleTiresShowOn')}</MenuItem>
            <MenuItem value="auto">{t('vehicleTiresShowAuto')}</MenuItem>
          </TextField>
        </div>
      );
      break;
    default:
      fields = (
        <div className={classes.fields}>
          <TextField
            label={t('adminSensorName')}
            value={sensor.label || ''}
            onChange={(event) => set({ label: event.target.value })}
          />
          <SourceField
            label={t('adminSensorSource')}
            value={sensor.source}
            options={withKeys(analogInputs)}
            onChange={(source) => set({ source })}
          />
          <TextField
            type="number"
            label={t('parameterFactor')}
            value={numberField(sensor.factor)}
            onChange={(event) => set({ factor: toNumber(event.target.value) })}
          />
          <TextField
            type="number"
            label={t('parameterOffset')}
            value={numberField(sensor.offset)}
            onChange={(event) => set({ offset: toNumber(event.target.value) })}
          />
          <TextField
            label={t('parameterUnit')}
            value={sensor.unit || ''}
            onChange={(event) => set({ unit: event.target.value })}
          />
        </div>
      );
  }

  return (
    <div className={cx(classes.card, problem && classes.cardProblem)}>
      <div className={classes.head}>
        <span className={classes.icon}>
          <Icon />
        </span>
        <div className={classes.titles}>
          <Typography variant="subtitle2" className={classes.title}>
            {sensor.label?.trim() || t(sensorTitleKey(sensor.type))}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {t(`${sensorTitleKey(sensor.type)}Help`)}
          </Typography>
        </div>
        {sensor.type !== 'tires' && (
          <Typography variant="caption" className={classes.live}>
            {`${t('adminSensorNow')}: `}
            <span className={classes.liveValue} dir="ltr">
              {formatLive(live, t)}
            </span>
          </Typography>
        )}
        <Tooltip title={t('sharedRemove')}>
          <IconButton size="small" onClick={onRemove} aria-label={t('sharedRemove')}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </div>
      {fields}
      {problem && (
        <Typography variant="caption" className={classes.problem}>
          {t(problem)}
        </Typography>
      )}
    </div>
  );
};

// List of the device's sensors plus "add" tiles for every sensor kind.
const SensorsEditor = ({ sensors, onChange, position }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const positionKeys = useMemo(
    () =>
      Object.entries(position?.attributes || {})
        .filter(([, value]) => typeof value === 'number' || typeof value === 'boolean')
        .map(([key]) => key)
        .sort(),
    [position],
  );

  const used = new Set(sensors.map((sensor) => sensor.type));
  const available = sensorTypes.filter((type) => !singleSensors.has(type) || !used.has(type));

  return (
    <>
      {sensors.length > 0 && (
        <div className={classes.list}>
          {sensors.map((sensor) => (
            <SensorCard
              key={sensor.id}
              sensor={sensor}
              position={position}
              positionKeys={positionKeys}
              onChange={(next) => onChange(sensors.map((it) => (it.id === sensor.id ? next : it)))}
              onRemove={() => onChange(sensors.filter((it) => it.id !== sensor.id))}
            />
          ))}
        </div>
      )}
      {available.length > 0 && (
        <>
          <Typography variant="body2" className={classes.sectionLabel}>
            {t('adminSensorAdd')}
          </Typography>
          <div className={classes.addGrid}>
            {available.map((type) => {
              const Icon = sensorIcons[type];
              return (
                <Button
                  key={type}
                  variant="outlined"
                  color="inherit"
                  className={classes.addTile}
                  startIcon={<Icon />}
                  endIcon={<AddRoundedIcon fontSize="small" />}
                  onClick={() => onChange([...sensors, createSensor(type, sensors)])}
                >
                  <span className={classes.addText}>
                    <Typography component="span" variant="body2" className={classes.addTitle}>
                      {t(sensorTitleKey(type))}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      className={classes.addDescription}
                    >
                      {t(`${sensorTitleKey(type)}Help`)}
                    </Typography>
                  </span>
                </Button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};

export default SensorsEditor;
