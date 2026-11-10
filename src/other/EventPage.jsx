import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { Typography } from '@mui/material';
import LocationOffRoundedIcon from '@mui/icons-material/LocationOffRounded';

import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { useParams } from 'react-router-dom';
import { useAsyncTask } from '../reactHelper';
import { useTranslation } from '../common/components/LocalizationProvider';
import MapView from '../map/core/MapView';
import MapCamera from '../map/MapCamera';
import MapPositionMarkers from '../map/MapPositionMarkers';
import MapGeofence from '../map/MapGeofence';
import StatusCard from '../common/components/StatusCard';
import { formatNotificationTitle, formatTime } from '../common/util/formatter';
import MapScale from '../map/MapScale';
import PageHeader from '../common/components/shell/PageHeader';
import fetchOrThrow from '../common/util/fetchOrThrow';
import BrandLoader from '../common/components/brand/BrandLoader';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  mapContainer: {
    position: 'relative',
    flexGrow: 1,
  },
  // LIV-18: over the map while loading, or when the event has no location.
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(3),
    textAlign: 'center',
    backgroundColor: alpha(theme.palette.background.default, 0.85),
  },
  icon: {
    fontSize: 40,
    color: theme.palette.text.secondary,
  },
}));

const EventPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();

  const { id } = useParams();

  const [event, setEvent] = useState();
  const [position, setPosition] = useState();
  const [showCard, setShowCard] = useState(true);
  // True once the event (and its position, if any) arrived, or failed to.
  const [loaded, setLoaded] = useState(false);
  const device = useSelector((state) => (event ? state.devices.items[event.deviceId] : undefined));

  const formatType = (event) =>
    formatNotificationTitle(t, {
      type: event.type,
      attributes: {
        alarms: event.attributes.alarm,
      },
    });

  const onMarkerClick = useCallback(
    (positionId) => {
      setShowCard(Boolean(positionId));
    },
    [setShowCard],
  );

  useAsyncTask(
    async ({ signal }) => {
      if (id) {
        try {
          const response = await fetchOrThrow(`api/events/${id}`, { signal });
          setEvent(await response.json());
        } catch (error) {
          if (!signal.aborted) setLoaded(true);
          throw error;
        }
      }
    },
    [id],
  );

  useAsyncTask(
    async ({ signal }) => {
      if (!event) return;
      try {
        if (event.positionId) {
          const response = await fetchOrThrow(`api/positions?id=${event.positionId}`, { signal });
          const positions = await response.json();
          if (positions.length > 0) {
            setPosition(positions[0]);
          }
        }
      } finally {
        if (!signal.aborted) setLoaded(true);
      }
    },
    [event],
  );

  return (
    <div className={classes.root}>
      <PageHeader
        back
        backTo="/"
        // "Speeding · Truck 12"
        title={event ? [formatType(event), device?.name].filter(Boolean).join(' · ') : ''}
        description={event ? formatTime(event.eventTime, 'seconds') : undefined}
      />
      <div className={classes.mapContainer}>
        <MapView>
          <MapGeofence />
          {position && (
            <MapPositionMarkers
              positions={[position]}
              onMarkerClick={onMarkerClick}
              titleField="fixTime"
            />
          )}
        </MapView>
        <MapScale />
        {!loaded && (
          <div className={classes.overlay}>
            <BrandLoader size={56} label={t('sharedLoading')} />
          </div>
        )}
        {loaded && !position && (
          <div className={classes.overlay} role="status">
            <LocationOffRoundedIcon className={classes.icon} />
            <Typography variant="h6">{t('eventNoLocation')}</Typography>
            <Typography variant="body2" color="textSecondary">
              {t('eventNoLocationHint')}
            </Typography>
          </div>
        )}
        {position && <MapCamera latitude={position.latitude} longitude={position.longitude} />}
        {position && showCard && (
          <StatusCard
            deviceId={position.deviceId}
            position={position}
            onClose={() => setShowCard(false)}
            disableActions
          />
        )}
      </div>
    </div>
  );
};

export default EventPage;
