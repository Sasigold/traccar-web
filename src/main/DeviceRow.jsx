import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import {
  Tooltip,
  Avatar,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Typography,
} from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60';
import Battery20Icon from '@mui/icons-material/Battery20';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
  formatAlarm,
  formatBoolean,
  formatPercentage,
  formatSpeed,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { isDeviceMoving, mapIconKey, mapIcons, movingCategories } from '../map/core/preloadImages';
import { GLYPH_BOX, prefersReducedMotion } from '../map/core/movingIcon';
import speedLinesSvg from '../resources/images/speed-lines.svg';
import speedLinesStaticSvg from '../resources/images/speed-lines-static.svg';
import { useAdministrator } from '../common/util/permissions';
import EngineIcon from '../resources/images/data/engine.svg?react';
import { useAttributePreference } from '../common/util/preferences';
import GeofencesValue from '../common/components/GeofencesValue';
import DriverValue from '../common/components/DriverValue';
import MotionBar from './components/MotionBar';
import useActivityText from '../common/components/useActivityText';
import { brandTile, statusColor } from '../common/theme/surfaces';
import Highlight from '../common/components/Highlight';
import { deviceSearchFields, matchDevice } from '../common/util/deviceSearch';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  row: {
    height: 64,
    marginBlock: 4,
    marginInline: theme.spacing(1),
    paddingInline: theme.spacing(1.25),
    gap: theme.spacing(1),
    borderRadius: theme.tokens.radius.lg,
    border: '1px solid transparent',
    transition: 'background-color 140ms ease, border-color 140ms ease',
    '&:hover': {
      backgroundColor: alpha(theme.palette.text.primary, 0.04),
    },
    '&::before': {
      display: 'none',
    },
  },
  avatarWrapper: {
    minWidth: 0,
  },
  avatarBox: {
    position: 'relative',
    display: 'inline-flex',
  },
  // Navy tile with an aqua glyph: the app icon, repeated per vehicle.
  avatar: {
    ...brandTile(),
    width: 42,
    height: 42,
    borderRadius: theme.tokens.radius.md,
    border:
      theme.palette.mode === 'dark' ? `1px solid ${theme.palette.surface.borderStrong}` : 'none',
  },
  avatarIdle: {
    color: alpha(theme.palette.brand.ice, 0.5),
  },
  statusDot: {
    position: 'absolute',
    bottom: -3,
    insetInlineEnd: -3,
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: `2px solid ${theme.palette.background.paper}`,
  },
  primaryText: {
    fontWeight: 600,
    fontSize: '0.9375rem',
    letterSpacing: '-0.005em',
  },
  secondaryText: {
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
  },
  secondaryValue: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  speed: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 18,
    paddingInline: 6,
    borderRadius: 6,
    fontSize: '0.6875rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: theme.palette.primary.main,
    backgroundColor: theme.palette.surface.tint,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  indicators: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  indicator: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 9,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
  },
  icon: {
    width: 22,
    height: 22,
    backgroundColor: 'currentColor',
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  },
  iconBox: {
    position: 'relative',
    width: 24,
    height: 24,
  },
  success: {
    color: theme.palette.success.main,
  },
  warning: {
    color: theme.palette.warning.main,
  },
  error: {
    color: theme.palette.error.main,
  },
  neutral: {
    color: theme.palette.neutral.main,
  },
  neutralText: {
    color: theme.palette.text.secondary,
  },
  selected: {
    '&&': {
      // Direction A: the selected vehicle is a plain ice tile.
      backgroundColor: theme.palette.surface.tint,
    },
  },
  // One short flash when a vehicle is selected elsewhere (map, quick search), so the eye finds
  // the row the list scrolled to.
  flash: {
    position: 'absolute',
    inset: 0,
    borderRadius: 'inherit',
    pointerEvents: 'none',
    backgroundColor: alpha(theme.palette.brand.aqua, 0.3),
    opacity: 0,
    animation: `${keyframes`
      from { opacity: 1; }
      to { opacity: 0; }
    `} 600ms ease-out`,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
}));

const DeviceRow = ({ devices, tokens = [], index, style }) => {
  const { classes, cx, theme } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const selectTime = useSelector((state) => state.devices.selectTime);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);
  const groups = useSelector((state) => state.groups.items);
  const drivers = useSelector((state) => state.drivers.items);

  const devicePrimary = useAttributePreference('devicePrimary', 'name');
  const deviceSecondary = useAttributePreference('deviceSecondary', '');
  const speedUnit = useAttributePreference('speedUnit');

  const resolveFieldValue = (field) => {
    if (field === 'geofenceIds') {
      const geofenceIds = position?.geofenceIds;
      return geofenceIds?.length ? <GeofencesValue geofenceIds={geofenceIds} /> : null;
    }
    if (field === 'driverUniqueId') {
      const driverUniqueId = position?.attributes?.driverUniqueId;
      return driverUniqueId ? <DriverValue driverUniqueId={driverUniqueId} /> : null;
    }
    if (field === 'motion') {
      return <MotionBar deviceId={item.id} />;
    }
    return item[field];
  };

  const digitFields = ['uniqueId', 'phone'];
  const highlight = (field, value) =>
    tokens.length && typeof value === 'string' ? (
      <Highlight text={value} tokens={tokens} digits={digitFields.includes(field)} />
    ) : (
      value
    );

  // While searching, the field that matched (plate, driver, group…) is shown and marked when the
  // row does not show it already.
  const shownKeys = [devicePrimary, deviceSecondary];
  const extraMatch = tokens.length
    ? matchDevice(tokens, deviceSearchFields(item, { groups, drivers, position }))?.fields.find(
        (field) =>
          !shownKeys.includes(field.key) &&
          !(field.key === 'driver' && shownKeys.includes('driverUniqueId')),
      )
    : null;

  const primaryValue = highlight(devicePrimary, resolveFieldValue(devicePrimary));
  const extraDigits = extraMatch?.key === 'plate' || digitFields.includes(extraMatch?.key);
  const secondaryValue = extraMatch ? (
    <bdi dir={extraDigits ? 'ltr' : 'auto'}>
      <Highlight text={extraMatch.value} tokens={tokens} digits={extraDigits} />
    </bdi>
  ) : (
    highlight(deviceSecondary, resolveFieldValue(deviceSecondary))
  );

  const moving = Boolean(position && (position.attributes?.motion || position.speed > 1));

  const { activity, label: activityLabel, tone: activityTone } = useActivityText(item, position);

  const secondaryText = () => {
    return (
      <>
        <span className={cx(classes.secondaryValue, classes[activityTone])}>{activityLabel}</span>
        {secondaryValue && (
          <>
            <span>·</span>
            <span className={classes.secondaryValue}>{secondaryValue}</span>
          </>
        )}
        {moving && activity === 'moving' && (
          <span className={classes.speed}>{formatSpeed(position.speed, speedUnit, t)}</span>
        )}
      </>
    );
  };

  const avatarClass = cx(classes.avatar, item.status !== 'online' && classes.avatarIdle);
  const iconKey = mapIconKey(item.category);
  const iconUrl = `url("${mapIcons[iconKey]}")`;
  const driving = movingCategories.has(iconKey) && isDeviceMoving(item, position);
  const linesUrl = `url("${prefersReducedMotion() ? speedLinesStaticSvg : speedLinesSvg}")`;

  return (
    <div style={style} role="listitem">
      <ListItemButton
        key={item.id}
        onClick={() => dispatch(devicesActions.selectId(item.id))}
        disabled={!admin && item.disabled}
        selected={selectedDeviceId === item.id}
        aria-pressed={selectedDeviceId === item.id}
        className={cx(classes.row, selectedDeviceId === item.id && classes.selected)}
      >
        {selectedDeviceId === item.id && (
          <span key={selectTime} className={classes.flash} aria-hidden />
        )}
        <ListItemAvatar className={classes.avatarWrapper}>
          <span className={classes.avatarBox}>
            <Avatar className={avatarClass}>
              {driving ? (
                // Inline geometry (not makeStyles) so the RTL plugin keeps the streaks behind
                // the vehicle; same layout as the animated map marker.
                <span className={classes.iconBox}>
                  <span
                    className={classes.icon}
                    style={{
                      position: 'absolute',
                      left: `${GLYPH_BOX.x * 100}%`,
                      top: `${GLYPH_BOX.y * 100}%`,
                      width: `${GLYPH_BOX.size * 100}%`,
                      height: `${GLYPH_BOX.size * 100}%`,
                      maskImage: iconUrl,
                      WebkitMaskImage: iconUrl,
                    }}
                  />
                  <span
                    className={classes.icon}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      maskImage: linesUrl,
                      WebkitMaskImage: linesUrl,
                    }}
                  />
                </span>
              ) : (
                <span
                  className={classes.icon}
                  style={{ maskImage: iconUrl, WebkitMaskImage: iconUrl }}
                />
              )}
            </Avatar>
            <span
              className={classes.statusDot}
              style={{ backgroundColor: statusColor(theme, item.status) }}
            />
          </span>
        </ListItemAvatar>
        <ListItemText
          primary={primaryValue}
          secondary={secondaryText()}
          slots={{
            primary: Typography,
            secondary: Typography,
          }}
          slotProps={{
            primary: { noWrap: true, className: classes.primaryText },
            secondary: { component: 'span', className: classes.secondaryText },
          }}
        />
        {position && (
          <span className={classes.indicators}>
            {position.attributes.hasOwnProperty('alarm') && (
              <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                <span role="img" className={classes.indicator}>
                  <ErrorRoundedIcon fontSize="small" className={classes.error} />
                </span>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('ignition') && (
              <Tooltip
                title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
              >
                <span role="img" className={classes.indicator}>
                  {position.attributes.ignition ? (
                    <EngineIcon width={18} height={18} className={classes.success} />
                  ) : (
                    <EngineIcon width={18} height={18} className={classes.neutral} />
                  )}
                </span>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('batteryLevel') && (
              <Tooltip
                title={`${t('positionBatteryLevel')}: ${formatPercentage(position.attributes.batteryLevel)}`}
              >
                <span role="img" className={classes.indicator}>
                  {(position.attributes.batteryLevel > 70 &&
                    (position.attributes.charge ? (
                      <BatteryChargingFullIcon fontSize="small" className={classes.success} />
                    ) : (
                      <BatteryFullIcon fontSize="small" className={classes.success} />
                    ))) ||
                    (position.attributes.batteryLevel > 30 &&
                      (position.attributes.charge ? (
                        <BatteryCharging60Icon fontSize="small" className={classes.warning} />
                      ) : (
                        <Battery60Icon fontSize="small" className={classes.warning} />
                      ))) ||
                    (position.attributes.charge ? (
                      <BatteryCharging20Icon fontSize="small" className={classes.error} />
                    ) : (
                      <Battery20Icon fontSize="small" className={classes.error} />
                    ))}
                </span>
              </Tooltip>
            )}
          </span>
        )}
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
