// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useSelector } from 'react-redux';

const GeofencesValue = ({ geofenceIds }) => {
  const geofences = useSelector((state) => state.geofences.items);

  return geofenceIds.map((id) => geofences[id]?.name).join(', ');
};

export default GeofencesValue;
