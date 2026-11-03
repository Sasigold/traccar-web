import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { keyframes } from 'tss-react';
import { alpha } from '@mui/material/styles';
import {
  IconButton,
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
  formatStatus,
  getStatusColor,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { mapIconKey, mapIcons } from '../map/core/preloadImages';
import { useAdministrator } from '../common/util/permissions';
import EngineIcon from '../resources/images/data/engine.svg?react';
import { useAttributePreference } from '../common/util/preferences';
import GeofencesValue from '../common/components/GeofencesValue';
import DriverValue from '../common/components/DriverValue';
import MotionBar from './components/MotionBar';
import { accentGradient, statusColor } from '../common/theme/surfaces';

dayjs.extend(relativeTime);

const ping = keyframes`
  0% { transform: scale(1); opacity: 0.7; }
  80%, 100% { transform: scale(2.6); opacity: 0; }
`;

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
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundImage: accentGradient(theme),
    boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.25)}, inset 0 1px 0 ${alpha('#ffffff', 0.3)}`,
  },
  avatarMoving: {
    backgroundImage: `linear-gradient(135deg, ${theme.palette.success.main}, ${alpha(theme.palette.secondary.main, 0.9)})`,
    boxShadow: `0 6px 16px ${alpha(theme.palette.success.main, 0.3)}, inset 0 1px 0 ${alpha('#ffffff', 0.3)}`,
  },
  avatarOffline: {
    backgroundImage: 'none',
    backgroundColor: alpha(theme.palette.error.main, 0.8),
    boxShadow: 'none',
  },
  avatarUnknown: {
    backgroundImage: 'none',
    backgroundColor: theme.palette.neutral.main,
    boxShadow: 'none',
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
  statusPing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    backgroundColor: 'inherit',
    animation: `${ping} 2.2s cubic-bezier(0, 0, 0.2, 1) infinite`,
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
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  trailing: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  time: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  indicators: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 7,
    padding: 0,
    backgroundColor: theme.palette.surface.sunken,
    '& svg': {
      fontSize: 16,
    },
  },
  icon: {
    width: '22px',
    height: '22px',
    filter: 'brightness(0) invert(1)',
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
  info: {
    color: theme.palette.info.main,
  },
  selected: {
    '&&': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
      borderColor: alpha(theme.palette.primary.main, 0.3),
    },
  },
}));

const DeviceRow = ({ devices, index, style }) => {
  const { classes, cx, theme } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);

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

  const primaryValue = resolveFieldValue(devicePrimary);
  const secondaryValue = resolveFieldValue(deviceSecondary);

  const moving = Boolean(position && (position.attributes?.motion || position.speed > 1));

  const secondaryText = () => {
    let status;
    let statusClass;
    if (item.status === 'online' && position) {
      status = moving ? t('dashboardStateMoving') : t('dashboardStateStopped');
      statusClass = moving ? classes.success : classes.info;
    } else {
      status = formatStatus(item.status, t);
      statusClass = classes[getStatusColor(item.status)];
    }
    return (
      <>
        <span className={cx(classes.secondaryValue, statusClass)}>{status}</span>
        {secondaryValue && (
          <>
            <span>·</span>
            <span className={classes.secondaryValue}>{secondaryValue}</span>
          </>
        )}
        {moving && (
          <span className={classes.speed}>{formatSpeed(position.speed, speedUnit, t)}</span>
        )}
      </>
    );
  };

  const avatarClass =
    item.status === 'online'
      ? cx(classes.avatar, moving && classes.avatarMoving)
      : cx(
          classes.avatar,
          item.status === 'offline' ? classes.avatarOffline : classes.avatarUnknown,
        );

  return (
    <div style={style}>
      <ListItemButton
        key={item.id}
        onClick={() => dispatch(devicesActions.selectId(item.id))}
        disabled={!admin && item.disabled}
        selected={selectedDeviceId === item.id}
        className={cx(classes.row, selectedDeviceId === item.id && classes.selected)}
      >
        <ListItemAvatar className={classes.avatarWrapper}>
          <span className={classes.avatarBox}>
            <Avatar className={avatarClass}>
              <img className={classes.icon} src={mapIcons[mapIconKey(item.category)]} alt="" />
            </Avatar>
            <span
              className={classes.statusDot}
              style={{
                backgroundColor: statusColor(theme, item.status),
                boxShadow:
                  item.status === 'online'
                    ? `0 0 8px ${alpha(statusColor(theme, item.status), 0.8)}`
                    : undefined,
              }}
            >
              {item.status === 'online' && <span className={classes.statusPing} />}
            </span>
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
        <span className={classes.trailing}>
          {item.lastUpdate && (
            <span className={classes.time}>{dayjs(item.lastUpdate).fromNow(true)}</span>
          )}
          {position && (
            <span className={classes.indicators}>
              {position.attributes.hasOwnProperty('alarm') && (
                <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                  <IconButton size="small" className={classes.indicator}>
                    <ErrorRoundedIcon fontSize="small" className={classes.error} />
                  </IconButton>
                </Tooltip>
              )}
              {position.attributes.hasOwnProperty('ignition') && (
                <Tooltip
                  title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
                >
                  <IconButton size="small" className={classes.indicator}>
                    {position.attributes.ignition ? (
                      <EngineIcon width={15} height={15} className={classes.success} />
                    ) : (
                      <EngineIcon width={15} height={15} className={classes.neutral} />
                    )}
                  </IconButton>
                </Tooltip>
              )}
              {position.attributes.hasOwnProperty('batteryLevel') && (
                <Tooltip
                  title={`${t('positionBatteryLevel')}: ${formatPercentage(position.attributes.batteryLevel)}`}
                >
                  <IconButton size="small" className={classes.indicator}>
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
                  </IconButton>
                </Tooltip>
              )}
            </span>
          )}
        </span>
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
