// @ts-nocheck -- ARC-11: not type-clean yet; remove this line when fixing the file.
import { useSelector } from 'react-redux';
import { useTranslation } from '../common/components/LocalizationProvider';
import usePositionAttributes from '../common/attributes/usePositionAttributes';
import useAttributeUnits from '../common/util/useAttributeUnits';
import { attributeFromRaw, attributeUnitString } from '../common/util/attributeUnits';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { isTimeType, maintenanceStatus, sortByUrgency } from '../common/fleet/maintenanceStatus';
import { formatGrouped } from '../common/util/formatter';

const DAY = 86400000;
const CONCURRENCY = 6;

// Formats an amount of a maintenance quantity (distance, hours, time) in the user's units.
export const useMaintenanceFormat = () => {
  const t = useTranslation();
  const units = useAttributeUnits();
  const positionAttributes = usePositionAttributes(t);
  return (type, raw) => {
    if (raw == null) {
      return '';
    }
    if (isTimeType(type)) {
      return `${Math.round(raw / DAY)} ${t('sharedDays')}`;
    }
    const dataType = positionAttributes[type]?.dataType;
    const value = attributeFromRaw(raw, dataType, units);
    const unit = attributeUnitString(dataType, units, t);
    const rounded = formatGrouped(Math.round(value), 0);
    return unit ? `${rounded} ${unit}` : rounded;
  };
};

// Maintenance linked to each vehicle, `deviceId` order kept, with how many vehicles share each.
export const loadMaintenanceLinks = async (deviceIds, signal) => {
  const links = [];
  const queue = [...deviceIds];
  const worker = async () => {
    while (queue.length) {
      const deviceId = queue.shift();
      const response = await fetchOrThrow(`api/maintenance?deviceId=${deviceId}`, { signal });
      const items = await response.json();
      items.forEach((maintenance) => links.push({ deviceId, maintenance }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, deviceIds.length) }, worker));
  const shared = {};
  links.forEach(({ maintenance }) => {
    shared[maintenance.id] = (shared[maintenance.id] || 0) + 1;
  });
  return { links, shared };
};

// Adds the computed status from the latest position of each vehicle.
export const useMaintenanceRows = (links) => {
  const positions = useSelector((state) => state.session.positions);
  const devices = useSelector((state) => state.devices.items);
  if (!links) {
    return null;
  }
  return sortByUrgency(
    links.map(({ deviceId, maintenance }) => ({
      key: `${deviceId}-${maintenance.id}`,
      deviceId,
      device: devices[deviceId],
      maintenance,
      state: maintenanceStatus(maintenance, positions[deviceId]),
    })),
  );
};

// "Mark as done": the service happened now, so the next one is a full period away.
export const markMaintenanceDone = async (maintenance, current) => {
  const response = await fetchOrThrow(`api/maintenance/${maintenance.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...maintenance, start: Math.round(current) }),
  });
  return response.json();
};
