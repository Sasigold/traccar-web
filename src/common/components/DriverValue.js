// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useSelector } from 'react-redux';

const DriverValue = ({ driverUniqueId }) => {
  const driver = useSelector((state) => state.drivers.items[driverUniqueId]);

  return driver?.name || driverUniqueId;
};

export default DriverValue;
