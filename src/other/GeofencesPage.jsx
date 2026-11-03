import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Typography, IconButton, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useNavigate } from 'react-router-dom';
import MapView from '../map/core/MapView';
import MapCurrentLocation from '../map/MapCurrentLocation';
import MapGeofenceEdit from '../map/draw/MapGeofenceEdit';
import GeofencesList from './GeofencesList';
import { useTranslation } from '../common/components/LocalizationProvider';
import MapGeocoder from '../map/control/MapGeocoder';
import { messagesActions } from '../store';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';

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
      height: theme.dimensions.drawerHeightPhone,
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
    fontWeight: 600,
  },
  mapContainer: {
    flexGrow: 1,
    position: 'relative',
  },
  fileInput: {
    display: 'none',
  },
}));

const GeofencesPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const [selectedGeofenceId, setSelectedGeofenceId] = useState();

  const handleFile = (event) => {
    const files = Array.from(event.target.files);
    const [file] = files;
    const reader = new FileReader();
    reader.onload = async () => {
      const xml = new DOMParser().parseFromString(reader.result, 'text/xml');
      const segment = xml.getElementsByTagName('trkseg')[0];
      const coordinates = Array.from(segment.getElementsByTagName('trkpt'))
        .map((point) => `${point.getAttribute('lat')} ${point.getAttribute('lon')}`)
        .join(', ');
      const area = `LINESTRING (${coordinates})`;
      const newItem = { name: t('sharedGeofence'), area };
      try {
        const response = await fetchOrThrow('api/geofences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem),
        });
        const item = await response.json();
        navigate(`/settings/geofence/${item.id}`);
      } catch (error) {
        dispatch(messagesActions.push(error.message));
      }
    };
    reader.onerror = (event) => {
      dispatch(messagesActions.push(event.target.error));
    };
    reader.readAsText(file);
  };

  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <div className={classes.drawer}>
          <div className={classes.header}>
            <IconButton edge="start" onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('sharedGeofences')}
            </Typography>
            <label htmlFor="upload-gpx">
              <input
                accept=".gpx"
                id="upload-gpx"
                type="file"
                className={classes.fileInput}
                onChange={handleFile}
              />
              <Tooltip title={t('sharedUpload')}>
                <IconButton edge="end" component="span" onClick={() => {}}>
                  <UploadFileRoundedIcon />
                </IconButton>
              </Tooltip>
            </label>
          </div>
          <GeofencesList
            onGeofenceSelected={setSelectedGeofenceId}
            selectedId={selectedGeofenceId}
          />
        </div>
        <div className={classes.mapContainer}>
          <MapView>
            <MapGeofenceEdit selectedGeofenceId={selectedGeofenceId} />
          </MapView>
          <MapScale />
          <MapCurrentLocation />
          <MapGeocoder />
        </div>
      </div>
    </div>
  );
};

export default GeofencesPage;
