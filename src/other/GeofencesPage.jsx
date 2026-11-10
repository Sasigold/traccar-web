import { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Button, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
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
import PageHeader from '../common/components/shell/PageHeader';
import { GEOFENCE_FILE_TYPES, parseGeofenceFile } from '../map/core/geofenceFile';
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

  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  // LIV-19: "new geofence" starts drawing a polygon on the map.
  const [drawRequest, setDrawRequest] = useState(0);
  // A real button (keyboard and screen readers) that opens the hidden file input.
  const fileRef = useRef(null);

  const handleFile = (event) => {
    const [file] = Array.from(event.target.files);
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let newItem;
      try {
        newItem = parseGeofenceFile(file.name, reader.result);
      } catch (error) {
        dispatch(messagesActions.push(t(error.message)));
        return;
      }
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
    reader.onerror = () => {
      dispatch(messagesActions.push(t('geofenceFileEmpty')));
    };
    reader.readAsText(file);
  };

  return (
    <div className={classes.root}>
      <PageHeader
        title={t('sharedGeofences')}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<UploadFileRoundedIcon />}
              title={t('geofenceFileHint')}
              onClick={() => fileRef.current?.click()}
            >
              {phone ? t('sharedUpload') : t('geofenceFromFile')}
            </Button>
            <input
              ref={fileRef}
              accept={GEOFENCE_FILE_TYPES}
              type="file"
              tabIndex={-1}
              aria-hidden="true"
              className={classes.fileInput}
              onChange={handleFile}
            />
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setDrawRequest((value) => value + 1)}
            >
              {t('geofenceNew')}
            </Button>
          </>
        }
      />
      <div className={classes.content}>
        <div className={classes.drawer}>
          <GeofencesList
            onGeofenceSelected={setSelectedGeofenceId}
            selectedId={selectedGeofenceId}
          />
        </div>
        <div className={classes.mapContainer}>
          <MapView>
            <MapGeofenceEdit selectedGeofenceId={selectedGeofenceId} drawRequest={drawRequest} />
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
