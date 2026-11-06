import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { collectExpiries, countExpiries } from '../common/fleet/fleetFields';

// Expiry dates of every visible vehicle and driver, from the cached Traccar objects.
const useExpiries = () => {
  const devices = useSelector((state) => state.devices.items);
  const drivers = useSelector((state) => state.drivers.items);
  return useMemo(() => {
    const rows = collectExpiries(Object.values(devices), Object.values(drivers));
    return { rows, counts: countExpiries(rows) };
  }, [devices, drivers]);
};

export default useExpiries;
