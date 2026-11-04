import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../LocalizationProvider';
import usePositionAttributes from '../../attributes/usePositionAttributes';
import { FuelGauge, SpeedGauge } from './TelemetryDashboard';
import { TirePressureCompact } from './TirePressure';
import { fuelReading, isNumber, parseProfile, tireReading } from './vehicleProfile';
import { BatteryGlyph, useLevelColor } from './TelemetryWidgets';
import { states } from './telemetryCatalog';

// Compact live readout for the vehicle card on the map: speed and fuel dials,
// tire pressures, battery level and the main on/off states.
const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'stretch',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 2, 1),
  },
  cell: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    padding: theme.spacing(1, 0.5, 0.75),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.surface.sunken,
  },
  label: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: theme.palette.surface.textSecondaryOnTint,
    whiteSpace: 'nowrap',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.75),
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontSize: '0.75rem',
    fontWeight: 600,
    color: theme.palette.text.primary,
    '& svg': { fontSize: 16 },
  },
  icon: {
    display: 'inline-flex',
    color: theme.palette.text.secondary,
  },
  iconOn: {
    color: theme.palette.success.main,
  },
}));

const TelemetryStrip = ({ position, device }) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const levelColor = useLevelColor();
  const positionAttributes = usePositionAttributes(t);

  const profile = parseProfile(device);
  const fuel = fuelReading(position, device, profile);
  const tires = tireReading(position, device, profile);
  const { batteryLevel, ignition, motion } = position.attributes;

  return (
    <div className={classes.root}>
      <div className={classes.cell}>
        <SpeedGauge position={position} device={device} size={104} compact />
        <span className={classes.label}>{positionAttributes.speed?.name}</span>
      </div>
      {fuel && (
        <div className={classes.cell}>
          <FuelGauge reading={fuel} size={104} compact />
          <span className={classes.label}>{positionAttributes.fuel?.name}</span>
        </div>
      )}
      {tires && (
        <div className={classes.cell} style={{ flex: '0 0 auto', paddingInline: 8 }}>
          <TirePressureCompact reading={tires} />
          <span className={classes.label}>{t('telemetryTiresShort')}</span>
        </div>
      )}
      {(isNumber(batteryLevel) || typeof ignition === 'boolean' || typeof motion === 'boolean') && (
        <div
          className={cx(classes.cell, classes.stack)}
          style={{ alignItems: 'stretch', paddingInline: 10 }}
        >
          {isNumber(batteryLevel) && (
            <span className={classes.row} style={{ flexWrap: 'wrap', rowGap: 2 }}>
              <BatteryGlyph
                ratio={batteryLevel / 100}
                color={levelColor(batteryLevel / 100, { lowWarn: 0.3, lowError: 0.15 })}
                charging={position.attributes.charge}
              />
              {Math.round(batteryLevel)}%
            </span>
          )}
          {[
            ['ignition', ignition],
            ['motion', motion],
          ]
            .filter(([, value]) => typeof value === 'boolean')
            .map(([key, value]) => (
              <span key={key} className={classes.row}>
                <span className={cx(classes.icon, value && classes.iconOn)}>
                  {states[key].icon}
                </span>
                {positionAttributes[key]?.name}: {value ? t('telemetryOn') : t('telemetryOff')}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};

export default TelemetryStrip;
