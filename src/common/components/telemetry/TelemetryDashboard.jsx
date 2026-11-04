import { Button, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import AvTimerRoundedIcon from '@mui/icons-material/AvTimerRounded';
import { useTranslation } from '../LocalizationProvider';
import PositionValue from '../PositionValue';
import usePositionAttributes from '../../attributes/usePositionAttributes';
import { useAttributePreference } from '../../util/preferences';
import {
  distanceFromMeters,
  distanceUnitString,
  speedFromKnots,
  speedUnitString,
  volumeFromLiters,
  volumeUnitString,
} from '../../util/converter';
import { formatAlarm, formatCourse } from '../../util/formatter';
import ArcGauge from './ArcGauge';
import TirePressure from './TirePressure';
import { adjustValue, fuelReading, isNumber, parseProfile, tireReading } from './vehicleProfile';
import {
  AnimatedValue,
  BatteryGlyph,
  Compass,
  LevelBar,
  MetricTile,
  Odometer,
  SignalBars,
  StatusChip,
  useLevelColor,
} from './TelemetryWidgets';
import {
  consumed,
  defaultStateIcon,
  genericIcon,
  metrics,
  sections,
  states,
} from './telemetryCatalog';

const speedScale = { kmh: 180, mph: 120, kn: 100 };

const niceMax = (value, base, step) => Math.max(base, Math.ceil((value * 1.1) / step) * step);

export { fuelReading, isNumber };

const signalRatio = (rssi) => {
  if (rssi < 0) return (rssi + 113) / 62; // dBm, -113..-51
  if (rssi <= 5) return rssi / 5; // 0..5 bars
  return Math.min(rssi, 31) / 31; // GSM CSQ 0..31
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  alarm: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
    backgroundColor: alpha(theme.palette.error.main, 0.08),
    color: theme.palette.text.primary,
    fontWeight: 600,
  },
  alarmIcon: {
    display: 'inline-flex',
    padding: 6,
    borderRadius: theme.tokens.radius.sm,
    backgroundColor: theme.palette.error.main,
    color: theme.palette.common.white,
  },
  hero: {
    padding: theme.spacing(2.5),
    borderRadius: theme.tokens.radius.xl,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2, 1.5),
    },
  },
  gauges: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: theme.spacing(2),
    alignItems: 'end',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: theme.spacing(1.5, 1),
      '& > :first-of-type': { gridColumn: '1 / -1' },
    },
  },
  gauge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  },
  gaugeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    '& svg': { fontSize: 18, color: theme.palette.primary.main },
  },
  gaugeCaption: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  gaugeAction: {
    fontSize: '0.75rem',
    fontWeight: 600,
    paddingBlock: 2,
    minHeight: 0,
  },
  facts: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(2),
    borderTop: `1px solid ${theme.palette.surface.border}`,
  },
  fact: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  },
  factAddress: {
    flex: 1,
    minWidth: 200,
  },
  factIcon: {
    color: theme.palette.primary.main,
    flexShrink: 0,
  },
  factText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  factLabel: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  factValue: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    overflowWrap: 'anywhere',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.text.primary,
    '& svg': { fontSize: 20, color: theme.palette.primary.main },
  },
  sectionCount: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    paddingInline: theme.spacing(1),
    borderRadius: theme.tokens.radius.pill,
    backgroundColor: theme.palette.surface.tint,
  },
  chips: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: theme.spacing(1),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing(1.25),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: theme.spacing(1),
    },
  },
  unit: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
    marginInlineStart: 4,
  },
}));

const SpeedGauge = ({ position, device, size = 240, compact }) => {
  const { theme } = useStyles();
  const t = useTranslation();
  const speedUnit = useAttributePreference('speedUnit');
  const speed = speedFromKnots(position.speed || 0, speedUnit);
  const max = niceMax(speed, speedScale[speedUnit] || 180, 20);
  const limitKnots = Number(device?.attributes?.speedLimit || position.attributes.speedLimit);
  const limit = limitKnots > 0 ? speedFromKnots(limitKnots, speedUnit) : null;
  const over = limit != null && speed > limit;
  const step = max / 6;
  return (
    <ArcGauge
      value={speed}
      max={max}
      size={size}
      ticks={
        compact
          ? []
          : Array.from({ length: 7 }, (_, i) => ({ value: i * step, label: Math.round(i * step) }))
      }
      minorTicks={compact ? 0 : 30}
      zones={
        limit != null && limit < max
          ? [{ from: limit, to: max, color: theme.palette.error.main }]
          : []
      }
      color={over ? theme.palette.error.main : undefined}
      unit={speedUnitString(speedUnit, t)}
      numberSize={compact ? 22 : 44}
      thickness={compact ? 10 : 12}
    />
  );
};

const FuelGauge = ({ reading, size = 220, compact }) => {
  const { theme } = useStyles();
  const percent = reading.ratio * 100;
  const color =
    percent <= 10
      ? theme.palette.error.main
      : percent <= 20
        ? theme.palette.warning.main
        : undefined;
  return (
    <ArcGauge
      value={Math.min(100, Math.max(0, percent))}
      max={100}
      size={size}
      sweep={200}
      ticks={
        compact
          ? []
          : [
              { value: 0, label: 'E' },
              { value: 25 },
              { value: 50, label: '½' },
              { value: 75 },
              { value: 100, label: 'F' },
            ]
      }
      minorTicks={compact ? 0 : 16}
      zones={[{ from: 0, to: 12, color: theme.palette.error.main }]}
      color={color}
      unit="%"
      numberSize={compact ? 22 : 36}
      thickness={compact ? 10 : 12}
      icon={
        compact ? null : (
          <LocalGasStationRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', mb: 0.5 }} />
        )
      }
    />
  );
};

const RpmGauge = ({ rpm, size = 220 }) => {
  const { theme } = useStyles();
  const max = niceMax(rpm, 8000, 1000);
  const ticks = Array.from({ length: max / 1000 + 1 }, (_, i) => ({ value: i * 1000, label: i }));
  return (
    <ArcGauge
      value={rpm}
      max={max}
      size={size}
      ticks={ticks}
      minorTicks={(max / 1000) * 4}
      zones={[{ from: max * 0.75, to: max, color: theme.palette.error.main }]}
      color={rpm >= max * 0.75 ? theme.palette.error.main : undefined}
      unit="RPM ×1000"
      formatValue={(v) => (v / 1000).toFixed(1)}
      numberSize={36}
    />
  );
};

// Every value on a position, routed into the dashboard: gauges first, then
// boolean states, then a section per subject, and a final section for anything
// the catalog does not know. Nothing on the position is left out.
const buildTelemetryModel = (position, profile, skip) => {
  const params = profile.params || {};
  const keys = [
    ...Object.keys(position)
      .filter((key) => key !== 'attributes')
      .map((key) => ({ key, property: true, value: position[key] })),
    ...Object.keys(position.attributes || {})
      .filter((key) => !Object.hasOwn(position, key))
      .map((key) => ({ key, property: false, value: position.attributes[key] })),
  ]
    .filter(
      ({ key, value }) =>
        !consumed.has(key) &&
        !skip.has(key) &&
        !params[key]?.hidden &&
        value != null &&
        value !== '',
    )
    .map((item) => {
      const config = params[item.key];
      if (!config) return item;
      return {
        ...item,
        value: adjustValue(item.value, config),
        label: config.label,
        unit: config.unit,
        adjusted: isNumber(item.value) && (config.factor != null || config.offset != null),
      };
    });

  const chips = [];
  const grouped = Object.fromEntries(sections.map((section) => [section.key, []]));
  keys.forEach((item) => {
    if (typeof item.value === 'boolean') {
      chips.push(item);
    } else {
      grouped[metrics[item.key]?.section || 'other'].push(item);
    }
  });
  const stateOrder = Object.keys(states);
  chips.sort((a, b) => {
    const ia = stateOrder.indexOf(a.key);
    const ib = stateOrder.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return { chips, grouped };
};

const formatCustom = (value, unit) => `${Number(value.toFixed(2)).toLocaleString()} ${unit}`;

const MetricValue = ({ position, item }) => {
  if (item.unit && isNumber(item.value)) {
    return <AnimatedValue value={item.value} format={(v) => formatCustom(v, item.unit)} />;
  }
  const adjusted = item.adjusted
    ? item.property
      ? { ...position, [item.key]: item.value }
      : { ...position, attributes: { ...position.attributes, [item.key]: item.value } }
    : position;
  return (
    <PositionValue
      position={adjusted}
      property={item.property ? item.key : null}
      attribute={item.property ? null : item.key}
    />
  );
};

const Metric = ({ position, item, index, onEdit }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const levelColor = useLevelColor();
  const positionAttributes = usePositionAttributes(t);
  const distanceUnit = useAttributePreference('distanceUnit');
  const config = metrics[item.key] || {};
  const label = item.label || positionAttributes[item.key]?.name || item.key;
  const icon = config.icon || genericIcon(item.value);
  const value = item.value;
  const numeric = isNumber(value);
  const common = {
    icon,
    label,
    index,
    small: config.small,
    onClick: onEdit ? () => onEdit(item.key) : undefined,
  };
  const custom = item.unit ? <MetricValue position={position} item={item} /> : null;

  if (numeric) {
    switch (config.kind) {
      case 'percent': {
        const ratio = value / 100;
        const color = levelColor(
          ratio,
          config.high ? { invert: true, lowWarn: 0.15, lowError: 0.05 } : {},
        );
        return (
          <MetricTile
            {...common}
            value={custom || <AnimatedValue value={value} format={(v) => `${Math.round(v)}%`} />}
            footer={<LevelBar ratio={ratio} color={color} />}
          />
        );
      }
      case 'battery': {
        const ratio = value / 100;
        const color = levelColor(ratio, { lowWarn: 0.3, lowError: 0.15 });
        const tone = ratio <= 0.15 ? 'error' : ratio <= 0.3 ? 'warning' : undefined;
        return (
          <MetricTile
            {...common}
            tone={tone}
            value={custom || <AnimatedValue value={value} format={(v) => `${Math.round(v)}%`} />}
            visual={
              <BatteryGlyph ratio={ratio} color={color} charging={position.attributes.charge} />
            }
          />
        );
      }
      case 'voltage': {
        const scale = config.cell && value <= 5 ? 4.2 : value > 16 ? 30 : 15;
        return (
          <MetricTile
            {...common}
            value={<MetricValue position={position} item={item} />}
            footer={<LevelBar ratio={value / scale} />}
          />
        );
      }
      case 'temperature': {
        const hot = item.key === 'coolantTemp' || item.key === 'engineTemp';
        const tone = hot && value >= 110 ? 'error' : hot && value >= 100 ? 'warning' : undefined;
        const color =
          tone === 'error'
            ? theme.palette.error.main
            : tone === 'warning'
              ? theme.palette.warning.main
              : undefined;
        return (
          <MetricTile
            {...common}
            tone={tone}
            value={custom || <AnimatedValue value={value} format={(v) => `${v.toFixed(1)}°C`} />}
            footer={<LevelBar ratio={(value + 20) / 150} color={color} />}
          />
        );
      }
      case 'satellites':
        return (
          <MetricTile
            {...common}
            tone={value < 4 ? 'warning' : undefined}
            value={custom || <AnimatedValue value={value} format={(v) => Math.round(v)} />}
            visual={
              <SignalBars
                ratio={value / 12}
                color={value < 4 ? theme.palette.warning.main : undefined}
              />
            }
          />
        );
      case 'signal':
        return (
          <MetricTile
            {...common}
            value={<MetricValue position={position} item={item} />}
            visual={<SignalBars ratio={signalRatio(value)} />}
          />
        );
      case 'odometer':
        if (custom) break;
        return (
          <MetricTile
            {...common}
            value={<Odometer value={Math.round(distanceFromMeters(value, distanceUnit))} />}
            caption={distanceUnitString(distanceUnit, t)}
          />
        );
      default:
        break;
    }
  }

  if (item.key === 'course' && numeric && !custom) {
    return (
      <MetricTile
        {...common}
        value={
          <>
            {Math.round(value)}°<span className={classes.unit}>{formatCourse(value)}</span>
          </>
        }
        visual={<Compass course={value} />}
      />
    );
  }

  const long = typeof value === 'string' && value.length > 24;
  return (
    <MetricTile
      {...common}
      small={common.small || long || typeof value === 'object'}
      value={
        typeof value === 'object' && !Array.isArray(value) && item.key !== 'network' ? (
          <span dir="ltr">{JSON.stringify(value)}</span>
        ) : (
          <MetricValue position={position} item={item} />
        )
      }
    />
  );
};

// `onConfigure(tab)` opens the vehicle settings and `onEditParameter(key)` a
// single parameter's settings; without them the dashboard is read-only.
const TelemetryDashboard = ({ position, device, onConfigure, onEditParameter }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const positionAttributes = usePositionAttributes(t);
  const volumeUnit = useAttributePreference('volumeUnit');
  const profile = parseProfile(device);

  const fuel = fuelReading(position, device, profile);
  const tires = tireReading(position, device, profile);
  const skip = new Set([
    ...(fuel ? [fuel.key] : []),
    ...(tires ? Object.values(tires.wheels).map((wheel) => wheel.key) : []),
  ]);
  const { chips, grouped } = buildTelemetryModel(position, profile, skip);
  const fuelHidden = fuel && profile.params?.[fuel.key]?.hidden;
  const rpm = profile.params?.rpm?.hidden
    ? null
    : adjustValue(position.attributes.rpm, profile.params?.rpm);
  const alarm = position.attributes.alarm;
  const speedLimit = Number(device?.attributes?.speedLimit || position.attributes.speedLimit);

  let tileIndex = 0;

  return (
    <div className={classes.root}>
      {alarm && (
        <div className={classes.alarm} role="alert">
          <span className={classes.alarmIcon}>
            <NotificationsActiveRoundedIcon fontSize="small" />
          </span>
          <span>
            {t('positionAlarm')}: {formatAlarm(alarm, t)}
          </span>
        </div>
      )}

      <section className={classes.hero} aria-label={t('telemetryDriving')}>
        <div className={classes.gauges}>
          <div className={classes.gauge}>
            <span className={classes.gaugeLabel}>
              <SpeedRoundedIcon />
              {t('positionSpeed')}
            </span>
            <SpeedGauge position={position} device={device} />
            {speedLimit > 0 && (
              <span className={classes.gaugeCaption}>
                {t('attributeSpeedLimit')}:{' '}
                <PositionValue position={{ ...position, speedLimit }} property="speedLimit" />
              </span>
            )}
          </div>
          {fuel && !fuelHidden && (
            <div className={classes.gauge}>
              <span className={classes.gaugeLabel}>
                <LocalGasStationRoundedIcon />
                {profile.params?.[fuel.key]?.label || positionAttributes.fuel?.name}
              </span>
              <FuelGauge reading={fuel} />
              {fuel.liters != null ? (
                <span className={classes.gaugeCaption}>
                  {`${volumeFromLiters(fuel.liters, volumeUnit).toFixed(1)} ${volumeUnitString(volumeUnit, t)}`}
                  {fuel.capacity != null &&
                    ` ${t('vehicleOf')} ${volumeFromLiters(fuel.capacity, volumeUnit).toFixed(0)}`}
                </span>
              ) : onConfigure ? (
                <Button
                  size="small"
                  className={classes.gaugeAction}
                  onClick={() => onConfigure('fuel')}
                >
                  {t('telemetryFuelSetup')}
                </Button>
              ) : (
                <span className={classes.gaugeCaption}>{t('telemetryFuelHint')}</span>
              )}
            </div>
          )}
          {isNumber(rpm) && (
            <div className={classes.gauge}>
              <span className={classes.gaugeLabel}>
                <AvTimerRoundedIcon />
                {positionAttributes.rpm?.name}
              </span>
              <RpmGauge rpm={rpm} />
              <span className={classes.gaugeCaption}>{Math.round(rpm).toLocaleString()} RPM</span>
            </div>
          )}
        </div>
        <div className={classes.facts}>
          <div className={classes.fact}>
            <Compass course={position.course} />
            <span className={classes.factText}>
              <span className={classes.factLabel}>{positionAttributes.course?.name}</span>
              <span className={classes.factValue}>
                {Math.round(position.course || 0)}° {formatCourse(position.course || 0)}
              </span>
            </span>
          </div>
          <div className={`${classes.fact} ${classes.factAddress}`}>
            <PlaceRoundedIcon className={classes.factIcon} />
            <span className={classes.factText}>
              <span className={classes.factLabel}>{positionAttributes.address?.name}</span>
              <span className={classes.factValue}>
                <PositionValue position={position} property="address" />
              </span>
            </span>
          </div>
          {position.fixTime && (
            <div className={classes.fact}>
              <span className={classes.factText}>
                <span className={classes.factLabel}>{positionAttributes.fixTime?.name}</span>
                <span className={classes.factValue}>
                  <PositionValue position={position} property="fixTime" />
                </span>
              </span>
            </div>
          )}
        </div>
      </section>

      {tires && (
        <TirePressure
          reading={tires}
          onConfigure={onConfigure ? () => onConfigure('tires') : undefined}
        />
      )}

      {chips.length > 0 && (
        <section className={classes.section}>
          <Typography variant="h6" component="h2" className={classes.sectionTitle}>
            <ToggleOnRoundedIcon />
            {t('telemetryStatus')}
            <span className={classes.sectionCount}>{chips.length}</span>
          </Typography>
          <div className={classes.chips}>
            {chips.map((item, index) => {
              const config = states[item.key] || {};
              const on = item.value === true;
              const alert = config.alertWhen === item.value;
              return (
                <StatusChip
                  key={item.key}
                  index={index}
                  icon={config.icon || defaultStateIcon}
                  label={item.label || positionAttributes[item.key]?.name || item.key}
                  state={on ? t('telemetryOn') : t('telemetryOff')}
                  on={on}
                  alert={alert}
                  onClick={onEditParameter ? () => onEditParameter(item.key) : undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {sections
        .filter((section) => grouped[section.key].length > 0)
        .map((section) => (
          <section key={section.key} className={classes.section}>
            <Typography variant="h6" component="h2" className={classes.sectionTitle}>
              {section.icon}
              {t(section.title)}
              <span className={classes.sectionCount}>{grouped[section.key].length}</span>
            </Typography>
            <div className={classes.tiles}>
              {grouped[section.key].map((item) => {
                tileIndex += 1;
                return (
                  <Metric
                    key={`${item.property ? 'p' : 'a'}-${item.key}`}
                    position={position}
                    item={item}
                    index={Math.min(tileIndex, 20)}
                    onEdit={onEditParameter}
                  />
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
};

export { SpeedGauge, FuelGauge };

export default TelemetryDashboard;
