import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Button, Link } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { useTranslation } from './LocalizationProvider';
import { useCatch } from '../../reactHelper';
import { formatAddress } from '../util/formatter';
import { usePreference } from '../util/preferences';
import fetchOrThrow from '../util/fetchOrThrow';
import { useFleetPermission, useFleetStatus } from '../fleet/useFleet';
import { useFleetQuery } from '../data/fleetQuery';
import {
  addressKey,
  cachedAddress,
  geofenceAt,
  poiAt,
  requestAddress,
  subscribeAddress,
} from '../util/addressCache';

export const geocode = async (latitude, longitude) => {
  const query = new URLSearchParams({ latitude, longitude });
  const response = await fetchOrThrow(`api/server/geocode?${query.toString()}`);
  return response.text();
};

// REP-13: the address of a point. At one of the fleet's points of interest or inside a
// geofence, its name; otherwise the stored address,
// the address found earlier in this session, or a link to look it up (shared by every row with
// that point).
const AddressValue = ({ latitude, longitude, originalAddress }) => {
  const t = useTranslation();

  const addressEnabled = useSelector((state) => state.session.server.geocoderEnabled);
  const geofences = useSelector((state) => state.geofences.items);
  const coordinateFormat = usePreference('coordinateFormat');
  // The fleet's points of interest, read once for every row (shared cache).
  const poiAllowed = useFleetPermission('poi.read');
  const fleetReady = useFleetStatus() === 'ready';
  const { data: pois } = useFleetQuery(
    'pois',
    ['address-names'],
    (client) => client.from('pois').select('id, name, latitude, longitude, radius_m'),
    { enabled: poiAllowed && fleetReady },
  );

  const [address, setAddress] = useState(
    () => originalAddress || cachedAddress(latitude, longitude),
  );

  useEffect(() => {
    setAddress(originalAddress || cachedAddress(latitude, longitude));
    if (latitude == null || longitude == null) return undefined;
    return subscribeAddress(addressKey(latitude, longitude), (value) => {
      if (!originalAddress) setAddress(value);
    });
  }, [latitude, longitude, originalAddress]);

  const showAddress = useCatch(async (event) => {
    event.preventDefault();
    await requestAddress(latitude, longitude, geocode);
  });

  const place =
    latitude != null
      ? poiAt(pois, latitude, longitude) || geofenceAt(geofences, latitude, longitude)
      : null;
  if (place && !address) {
    return place.name;
  }
  if (address) {
    return address;
  }
  if (addressEnabled) {
    return (
      <Link href="#" onClick={showAddress}>
        {t('sharedShowAddress')}
      </Link>
    );
  }
  return formatAddress({ latitude, longitude }, coordinateFormat);
};

// REP-13: every address of the rows in view, three at a time, with one click.
export const AllAddressesButton = ({ points, className }) => {
  const t = useTranslation();
  const addressEnabled = useSelector((state) => state.session.server.geocoderEnabled);
  const [busy, setBusy] = useState(false);
  const missing = points.filter(
    (point) =>
      point &&
      point.latitude != null &&
      !point.address &&
      cachedAddress(point.latitude, point.longitude) === undefined,
  );
  const showAll = useCatch(async () => {
    setBusy(true);
    try {
      await Promise.all(
        missing.map((point) => requestAddress(point.latitude, point.longitude, geocode)),
      );
    } finally {
      setBusy(false);
    }
  });
  if (!addressEnabled || !missing.length) return null;
  return (
    <div className={className}>
      <Button
        fullWidth
        variant="outlined"
        startIcon={<PlaceRoundedIcon />}
        onClick={showAll}
        loading={busy}
      >
        {t('reportShowAllAddresses')}
      </Button>
    </div>
  );
};

export default AddressValue;
