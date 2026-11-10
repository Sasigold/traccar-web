import { memo, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { beat } from '../common/theme/motion';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import {
  Tooltip,
  Chip,
  Avatar,
  Checkbox,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Typography,
} from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFullRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFullRounded';
import Battery60Icon from '@mui/icons-material/Battery60Rounded';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60Rounded';
import Battery20Icon from '@mui/icons-material/Battery20Rounded';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20Rounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useLivePosition } from '../common/fleet/usePrivacy';
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
import useActivityText, { toneColor } from '../common/components/useActivityText';
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
  favorite: {
    fontSize: 16,
    verticalAlign: 'text-bottom',
    marginInlineEnd: theme.spacing(0.5),
    color: theme.palette.primary.main,
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
    borderRadius: theme.tokens.radius.xs,
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
  // LIV-30: the battery level is also written, not only drawn.
  batteryText: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    paddingInlineEnd: 4,
    fontVariantNumeric: 'tabular-nums',
  },
  batteryIndicator: {
    width: 'auto',
    minWidth: 30,
  },
  disabledChip: {
    height: 22,
    fontSize: '0.6875rem',
  },
  indicator: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: theme.tokens.radius.sm,
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
      // Direction A: the selected vehicle is a plain ice-aqua tile, light enough that the slate
      // secondary text keeps 4.5:1 on it.
      backgroundColor:
        theme.palette.mode === 'dark'
          ? theme.palette.surface.tint
          : alpha(theme.palette.brand.aqua, 0.1),
    },
  },
  // What the vehicle is doing: the status color is on the dot, the words stay in text color
  // (amber or aqua text would fall under 4.5:1).
  activity: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  activityQuiet: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  toneDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
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

// PRF-04: compiled by React Compiler, and memoized, so a live update re-renders only the rows
// of the vehicles that changed.
const DeviceRow = ({ devices, tokens = [], favorites = [], index, style, focusIndex }) => {
  'use memo';
  const { classes, cx, theme } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const selectTime = useSelector((state) => state.devices.selectTime);
  // LIV-25: while picking, a tap picks the vehicle instead of opening it.
  const picking = useSelector((state) => state.devices.picked != null);

  const item = devices[index];
  const picked = useSelector((state) => Boolean(state.devices.picked?.includes(item.id)));
  const position = useLivePosition(item.id);
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
        <span
          className={cx(
            classes.secondaryValue,
            classes.activity,
            activityTone === 'neutralText' && classes.activityQuiet,
          )}
        >
          <span
            className={classes.toneDot}
            style={{ backgroundColor: toneColor(theme, activityTone) }}
            aria-hidden
          />
          {activityLabel}
        </span>
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

  // LIV-30: one spoken label for the row's indicators (tooltips only help a mouse).
  const alarmLabel =
    position?.attributes.hasOwnProperty('alarm') &&
    `${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`;
  const ignitionLabel =
    position?.attributes.hasOwnProperty('ignition') &&
    `${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`;
  const batteryLabel =
    position?.attributes.hasOwnProperty('batteryLevel') &&
    `${t('positionBatteryLevel')}: ${formatPercentage(Math.round(position.attributes.batteryLevel))}`;
  const indicatorLabels = [
    item.disabled && t('deviceDisabledChip'),
    alarmLabel,
    ignitionLabel,
    batteryLabel,
  ].filter(Boolean);

  // BRD-03: when the status changes (online, offline...), the row lights up once and fades
  // (600ms), so the change is noticed without a loop.
  const rowRef = useRef(null);
  const statusRef = useRef(item.status);
  useEffect(() => {
    if (statusRef.current !== item.status) {
      beat(
        rowRef.current,
        [
          { backgroundColor: alpha(theme.palette.brand.aqua, 0.28) },
          { backgroundColor: 'transparent' },
        ],
        600,
      );
    }
    statusRef.current = item.status;
  }, [item.status, theme]);

  const avatarClass = cx(classes.avatar, item.status !== 'online' && classes.avatarIdle);
  const iconKey = mapIconKey(item.category);
  const iconUrl = `url("${mapIcons[iconKey]}")`;
  const driving = movingCategories.has(iconKey) && isDeviceMoving(item, position);
  const linesUrl = `url("${prefersReducedMotion() ? speedLinesStaticSvg : speedLinesSvg}")`;

  return (
    <div style={style} role="listitem">
      <ListItemButton
        ref={rowRef}
        key={item.id}
        onClick={() =>
          dispatch(
            picking ? devicesActions.togglePicked(item.id) : devicesActions.selectId(item.id),
          )
        }
        disabled={!admin && item.disabled}
        // LIV-30: one tab stop for the whole list; the arrows move between rows (DeviceList).
        tabIndex={focusIndex == null || focusIndex === index ? 0 : -1}
        data-row={index}
        selected={picking ? picked : selectedDeviceId === item.id}
        aria-pressed={picking ? picked : selectedDeviceId === item.id}
        className={cx(classes.row, selectedDeviceId === item.id && classes.selected)}
      >
        {selectedDeviceId === item.id && (
          <span key={selectTime} className={classes.flash} aria-hidden />
        )}
        {picking && (
          <Checkbox
            checked={picked}
            tabIndex={-1}
            size="small"
            sx={{ marginInlineEnd: 0.5 }}
            slotProps={{ input: { 'aria-hidden': true } }}
          />
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
          primary={
            favorites.includes(item.id) ? (
              <>
                <StarRoundedIcon className={classes.favorite} titleAccess={t('deviceFavorite')} />
                {primaryValue}
              </>
            ) : (
              primaryValue
            )
          }
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
        {(item.disabled || position) && (
          <span
            className={classes.indicators}
            role={indicatorLabels.length ? 'img' : undefined}
            aria-label={indicatorLabels.length ? indicatorLabels.join(', ') : undefined}
          >
            {item.disabled && (
              <Chip
                size="small"
                label={t('deviceDisabledChip')}
                className={classes.disabledChip}
                aria-hidden
              />
            )}
            {position?.attributes.hasOwnProperty('alarm') && (
              <Tooltip title={alarmLabel}>
                <span className={classes.indicator} aria-hidden>
                  <ErrorRoundedIcon fontSize="small" className={classes.error} />
                </span>
              </Tooltip>
            )}
            {position?.attributes.hasOwnProperty('ignition') && (
              <Tooltip title={ignitionLabel}>
                <span className={classes.indicator} aria-hidden>
                  {position.attributes.ignition ? (
                    <EngineIcon width={18} height={18} className={classes.success} />
                  ) : (
                    <EngineIcon width={18} height={18} className={classes.neutral} />
                  )}
                </span>
              </Tooltip>
            )}
            {position?.attributes.hasOwnProperty('batteryLevel') && (
              <Tooltip title={batteryLabel}>
                <span className={cx(classes.indicator, classes.batteryIndicator)} aria-hidden>
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
                  <bdi className={classes.batteryText} dir="ltr">
                    {formatPercentage(Math.round(position.attributes.batteryLevel))}
                  </bdi>
                </span>
              </Tooltip>
            )}
          </span>
        )}
      </ListItemButton>
    </div>
  );
};

export default memo(DeviceRow);
