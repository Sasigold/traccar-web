import { useCallback, useState } from 'react';

import { makeStyles } from 'tss-react/mui';
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

const useStyles = makeStyles()(() => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  mapContainer: {
    flexGrow: 1,
  },
}));

const EventPage = () => {
  const { classes } = useStyles();
  const t = useTranslation();

  const { id } = useParams();

  const [event, setEvent] = useState();
  const [position, setPosition] = useState();
  const [showCard, setShowCard] = useState(false);

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
        const response = await fetchOrThrow(`api/events/${id}`, { signal });
        setEvent(await response.json());
      }
    },
    [id],
  );

  useAsyncTask(
    async ({ signal }) => {
      if (event && event.positionId) {
        const response = await fetchOrThrow(`api/positions?id=${event.positionId}`, { signal });
        const positions = await response.json();
        if (positions.length > 0) {
          setPosition(positions[0]);
        }
      }
    },
    [event],
  );

  return (
    <div className={classes.root}>
      <PageHeader
        back
        backTo="/"
        title={event ? formatType(event) : ''}
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
