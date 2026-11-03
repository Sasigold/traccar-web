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
import ErrorIcon from '@mui/icons-material/Error';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
  formatAlarm,
  formatBoolean,
  formatPercentage,
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
import { accentGradient, statusColor } from '../common/theme/glass';

dayjs.extend(relativeTime);

const ping = keyframes`
  0% { transform: scale(1); opacity: 0.7; }
  80%, 100% { transform: scale(2.6); opacity: 0; }
`;

const useStyles = makeStyles()((theme) => ({
  row: {
    height: 64,
    marginBlock: 4,
    gap: theme.spacing(0.5),
    border: '1px solid transparent',
    transition: 'background-color 160ms ease, border-color 160ms ease',
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.06),
      borderColor: alpha(theme.palette.primary.main, 0.12),
    },
  },
  avatarWrapper: {
    minWidth: 52,
  },
  avatarBox: {
    position: 'relative',
    display: 'inline-flex',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: accentGradient(theme),
    boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.28)}, inset 0 1px 0 ${alpha('#ffffff', 0.25)}`,
    ...(theme.palette.mode === 'dark' && {
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.38)} 0%, ${alpha(theme.palette.info.main, 0.22)} 100%)`,
      border: `1px solid ${alpha(theme.palette.primary.main, 0.45)}`,
      boxShadow: `0 0 18px ${alpha(theme.palette.primary.main, 0.22)}, inset 0 1px 0 ${alpha('#ffffff', 0.12)}`,
    }),
  },
  avatarInactive: {
    border: 'none',
    background: `linear-gradient(135deg, ${theme.palette.neutral.main} 0%, ${alpha(theme.palette.neutral.main, 0.7)} 100%)`,
    boxShadow: 'none',
  },
  statusDot: {
    position: 'absolute',
    bottom: -3,
    right: -3,
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
  },
  indicator: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.04),
  },
  icon: {
    width: '22px',
    height: '22px',
    filter: 'brightness(0) invert(1)',
  },
  batteryText: {
    fontSize: '0.75rem',
    fontWeight: 'normal',
    lineHeight: '0.875rem',
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
  selected: {
    '&&': {
      background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.info.main, 0.06)} 100%)`,
      borderColor: alpha(theme.palette.primary.main, 0.3),
      boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
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

  const secondaryText = () => {
    let status;
    if (item.status === 'online' || !item.lastUpdate) {
      status = formatStatus(item.status, t);
    } else {
      status = dayjs(item.lastUpdate).fromNow();
    }
    return (
      <>
        {secondaryValue && (
          <>
            {secondaryValue}
            {' • '}
          </>
        )}
        <span className={classes[getStatusColor(item.status)]}>{status}</span>
      </>
    );
  };

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
            <Avatar
              className={cx(classes.avatar, item.status !== 'online' && classes.avatarInactive)}
            >
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
            secondary: { noWrap: true, className: classes.secondaryText },
          }}
        />
        {position && (
          <>
            {position.attributes.hasOwnProperty('alarm') && (
              <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
                <IconButton size="small" className={classes.indicator}>
                  <ErrorIcon fontSize="small" className={classes.error} />
                </IconButton>
              </Tooltip>
            )}
            {position.attributes.hasOwnProperty('ignition') && (
              <Tooltip
                title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
              >
                <IconButton size="small" className={classes.indicator}>
                  {position.attributes.ignition ? (
                    <EngineIcon width={20} height={20} className={classes.success} />
                  ) : (
                    <EngineIcon width={20} height={20} className={classes.neutral} />
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
          </>
        )}
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
