import { useSelector } from 'react-redux';
import { useLocalization } from '../components/LocalizationProvider';

export const useFleetStatus = () => useSelector((state) => state.fleet.status);

export const useFleetError = () => useSelector((state) => state.fleet.error);

export const useFleetReady = () => useSelector((state) => state.fleet.status === 'ready');

export const useFleetProfile = () => useSelector((state) => state.fleet.profile);

export const useFleetPermission = (key) =>
  useSelector((state) => state.fleet.status === 'ready' && state.fleet.permissions.includes(key));

// ADM-03: may this user look at the fleet area at all? Any fleet read permission is enough. A
// Traccar "read only" user (the viewer role) still reads the fleet; read only limits writing.
export const canReadFleet = (fleet) =>
  fleet.status === 'ready' && fleet.permissions.some((key) => key.endsWith('.read'));

export const useFleetReader = () => useSelector((state) => canReadFleet(state.fleet));

// Document types carry Hebrew and English labels; pick by the active UI language.
export const useFleetLabel = () => {
  const { language } = useLocalization();
  return (row) => (language === 'he' ? row?.label_he : row?.label_en) || row?.label_en || '';
};

// Expiry bucket for a document row (expires_at as YYYY-MM-DD, reminder_days as int).
export const documentExpiryStatus = (expiresAt, reminderDays = 30) => {
  if (!expiresAt) {
    return 'none';
  }
  const days = daysUntil(expiresAt);
  if (days < 0) {
    return 'expired';
  }
  if (days <= reminderDays) {
    return 'expiring';
  }
  return 'valid';
};

export const daysUntil = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};
