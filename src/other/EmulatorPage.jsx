import { useDispatch, useSelector } from 'react-redux';
import { Typography, IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useNavigate } from 'react-router-dom';
import MapView from '../map/core/MapView';
import MapCurrentLocation from '../map/MapCurrentLocation';
import { useTranslation } from '../common/components/LocalizationProvider';
import MapGeocoder from '../map/control/MapGeocoder';
import SelectField from '../common/components/SelectField';
import { devicesActions } from '../store';
import MapPositionMarkers from '../map/MapPositionMarkers';
import { useCatch } from '../reactHelper';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { deviceEquality } from '../common/util/deviceEquality';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flexGrow: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column-reverse',
    },
  },
  drawer: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    borderInlineEnd: `1px solid ${theme.palette.surface.border}`,
    [theme.breakpoints.up('sm')]: {
      width: theme.dimensions.devicePanelWidth,
      flexShrink: 0,
    },
    [theme.breakpoints.down('sm')]: {
      borderInlineEnd: 'none',
      borderTop: `1px solid ${theme.palette.surface.border}`,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 1.5, 1.5, 2),
    borderBottom: `1px solid ${theme.palette.surface.border}`,
  },
  title: {
    flexGrow: 1,
    fontWeight: 800,
  },
  form: {
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  hint: {
    color: theme.palette.text.secondary,
  },
  mapContainer: {
    flexGrow: 1,
    position: 'relative',
  },
}));

const EmulatorPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const devices = useSelector(
    (state) => state.devices.items,
    deviceEquality(['id', 'name', 'uniqueId']),
  );
  const deviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);

  const handleClick = useCatch(async (latitude, longitude) => {
    if (deviceId) {
      if (window.location.protocol === 'https:') {
        const params = new URLSearchParams();
        params.append('id', devices[deviceId].uniqueId);
        params.append('lat', latitude);
        params.append('lon', longitude);
        await fetchOrThrow(document.baseURI, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });
      } else {
        const params = new URLSearchParams();
        params.append('id', devices[deviceId].uniqueId);
        params.append('lat', latitude);
        params.append('lon', longitude);
        await fetch(`http://${window.location.hostname}:5055?${params.toString()}`, {
          method: 'POST',
          mode: 'no-cors',
        });
      }
    }
  });

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <div className={classes.drawer}>
          <div className={classes.header}>
            <IconButton edge="start" onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('sharedEmulator')}
            </Typography>
          </div>
          <div className={classes.form}>
            <SelectField
              label={t('reportDevice')}
              data={Object.values(devices).sort((a, b) => a.name.localeCompare(b.name))}
              value={deviceId}
              onChange={(e) => dispatch(devicesActions.selectId(e.target.value))}
              fullWidth
            />
            <Typography variant="caption" className={classes.hint}>
              {t('sharedEmulator')}
            </Typography>
          </div>
        </div>
        <div className={classes.mapContainer}>
          <MapView>
            <MapPositionMarkers
              positions={Object.values(positions)}
              onMapClick={handleClick}
              showStatus
            />
          </MapView>
          <MapScale />
          <MapCurrentLocation />
          <MapGeocoder />
        </div>
      </div>
    </div>
  );
};

export default EmulatorPage;
