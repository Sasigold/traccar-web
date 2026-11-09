import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, IconButton, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useLivePosition } from '../common/fleet/usePrivacy';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageHeader from '../common/components/shell/PageHeader';
import BrandLoader from '../common/components/brand/BrandLoader';
import TelemetryDashboard from '../common/components/telemetry/TelemetryDashboard';
import { useVehicleSettings } from '../common/components/telemetry/VehicleSettingsDialog';
import { formatStatus, formatTime } from '../common/util/formatter';
import { statusColor } from '../common/theme/surfaces';
import { devicesActions } from '../store';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(1, 3, 4),
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(2, 1.5, 3),
    },
  },
  inner: {
    maxWidth: 1200,
    marginInline: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: theme.palette.text.secondary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  live: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.25),
    borderRadius: theme.tokens.radius.pill,
    backgroundColor: theme.palette.surface.tint,
    border: `1px solid ${alpha(theme.palette.geometry.main, 0.4)}`,
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: theme.direction === 'rtl' ? 0 : '0.06em',
    color: theme.palette.text.primary,
  },
  liveDot: {
    position: 'relative',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.palette.success.main,
  },
  empty: {
    padding: theme.spacing(6, 2),
    textAlign: 'center',
  },
}));

const TelemetryPage = () => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { deviceId } = useParams();

  const device = useSelector((state) => state.devices.items[deviceId]);
  const position = useLivePosition(deviceId);
  const devicesLoaded = useSelector((state) => Object.keys(state.devices.items).length > 0);
  const settings = useVehicleSettings(device, position);
  const phone = useMediaQuery(theme.breakpoints.down('sm'));

  const showOnMap = () => {
    dispatch(devicesActions.selectId(Number(deviceId)));
    navigate('/');
  };

  return (
    <div className={classes.root}>
      <PageHeader
        back
        title={device?.name || t('telemetryTitle')}
        description={
          device && (
            <span className={classes.status}>
              <span
                className={classes.dot}
                style={{ backgroundColor: statusColor(theme, device.status) }}
              />
              {[
                t('telemetryTitle'),
                formatStatus(device.status, t),
                position?.fixTime &&
                  `${t('telemetryUpdated')} ${formatTime(position.fixTime, 'time')}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )
        }
        actions={
          device && (
            <>
              {device.status === 'online' && (
                <span className={classes.live} dir="ltr">
                  <span className={classes.liveDot} />
                  {t('mapLive')}
                </span>
              )}
              {settings.canEdit &&
                (phone ? (
                  <Tooltip title={t('vehicleSettings')}>
                    <IconButton
                      onClick={() => settings.openSettings('fuel')}
                      aria-label={t('vehicleSettings')}
                    >
                      <TuneRoundedIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<TuneRoundedIcon />}
                    onClick={() => settings.openSettings('fuel')}
                  >
                    {t('vehicleSettings')}
                  </Button>
                ))}
              <Button variant="outlined" startIcon={<MapRoundedIcon />} onClick={showOnMap}>
                {t('telemetryShowOnMap')}
              </Button>
            </>
          )
        }
      />
      <div className={classes.content}>
        <div className={classes.inner}>
          {position ? (
            <TelemetryDashboard
              position={position}
              device={device}
              onConfigure={settings.openSettings}
              onEditParameter={settings.openParameter}
            />
          ) : devicesLoaded ? (
            <Typography className={classes.empty} color="textSecondary">
              {t('telemetryNoData')}
            </Typography>
          ) : (
            <div className={classes.empty}>
              <BrandLoader />
            </div>
          )}
        </div>
      </div>
      {settings.element}
    </div>
  );
};

export default TelemetryPage;
