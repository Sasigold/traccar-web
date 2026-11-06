import { Button, IconButton, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate } from 'react-router-dom';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from '../LocalizationProvider';
import usePositionAttributes from '../../attributes/usePositionAttributes';
import { PROFILE_KEY, parseProfile } from './vehicleProfile';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.md,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.surface.sunken,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& > svg': {
      color: theme.palette.primary.main,
    },
  },
  title: {
    flex: 1,
    fontWeight: 600,
  },
  list: {
    margin: 0,
    paddingInlineStart: theme.spacing(2.5),
    color: theme.palette.text.secondary,
  },
  help: {
    color: theme.palette.text.secondary,
  },
}));

const capital = (value) => value.charAt(0).toUpperCase() + value.slice(1);

// The `web.vehicle` attribute holds the vehicle dashboard settings as JSON. Instead of showing
// that JSON, describe it in words and send the user to the screen that edits it.
const VehicleProfileSummary = ({ device, onRemove }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const positionAttributes = usePositionAttributes(t);

  const profile = parseProfile(device);
  const paramName = (key) => positionAttributes[key]?.name || key;
  const lines = [];

  if (profile.fuel) {
    const { source, unit } = profile.fuel;
    const parts = [
      source ? t('vehicleProfileFrom').replace('{0}', paramName(source)) : t('vehicleAuto'),
    ];
    if (unit === 'liters' || unit === 'percent') {
      parts.push(
        t('vehicleProfileUnit').replace(
          '{0}',
          t(unit === 'liters' ? 'vehicleFuelLiters' : 'vehicleFuelPercent'),
        ),
      );
    }
    lines.push(`${t('vehicleFuelTab')}: ${parts.join(', ')}`);
  }
  if (profile.tires) {
    const { show, unit, target, min } = profile.tires;
    const parts = [t(`vehicleProfileTires${capital(show || 'auto')}`)];
    if (unit) parts.push(t('vehicleProfileUnit').replace('{0}', unit.toUpperCase()));
    if (target != null) parts.push(`${t('vehicleTiresTarget')} ${target}`);
    if (min != null) parts.push(`${t('vehicleTiresMin')} ${min}`);
    lines.push(`${t('vehicleTiresTab')}: ${parts.join(', ')}`);
  }
  if (profile.params) {
    const names = Object.entries(profile.params).map(
      ([key, config]) => config.name || paramName(key),
    );
    lines.push(`${t('vehicleProfileParams')}: ${names.join(', ')}`);
  }
  if (profile.sensors?.length) {
    const names = profile.sensors.map(
      (sensor) => sensor.label || t(`adminSensor${capital(sensor.type)}`),
    );
    lines.push(`${t('vehicleProfileSensors')}: ${names.join(', ')}`);
  }

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <SpeedRoundedIcon fontSize="small" />
        <Typography variant="body2" className={classes.title}>
          {t('vehicleProfileTitle')}
        </Typography>
        {onRemove && (
          <Tooltip title={t('vehicleProfileReset')}>
            <IconButton size="small" aria-label={t('vehicleProfileReset')} onClick={onRemove}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </div>
      <Typography variant="caption" className={classes.help}>
        {t('vehicleProfileHelp')}
      </Typography>
      {lines.length > 0 && (
        <Typography variant="body2" component="ul" className={classes.list}>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </Typography>
      )}
      {device?.id && (
        <div>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/telemetry/${device.id}`)}
          >
            {t('vehicleProfileEdit')}
          </Button>
        </div>
      )}
    </div>
  );
};

export const isProfileKey = (key) => key === PROFILE_KEY;

export default VehicleProfileSummary;
