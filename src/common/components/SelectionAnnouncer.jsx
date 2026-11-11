import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from './LocalizationProvider';
import { announce } from './Announcer';
import { capitalize } from '../util/stringUtils';

// A11-08: choosing a vehicle (on the map, in the list, from the search) is said: "Selected:
// Truck 12 · online".
const SelectionAnnouncer = () => {
  const t = useTranslation();
  const selectedId = useSelector((state) => state.devices.selectedId);
  const device = useSelector((state) =>
    selectedId != null ? state.devices.items[selectedId] : null,
  );
  const saidRef = useRef(null);

  useEffect(() => {
    if (!device || saidRef.current === device.id) {
      if (!device) saidRef.current = null;
      return;
    }
    saidRef.current = device.id;
    const status = t(`deviceStatus${capitalize(device.status || 'unknown')}`);
    announce(t('a11ySelected').replace('{0}', [device.name, status].filter(Boolean).join(' · ')));
  }, [device, t]);

  return null;
};

export default SelectionAnnouncer;
