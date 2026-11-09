// The vehicles opened last, newest first, for the quick search before anything is typed.
// Only ids are kept; a vehicle the current user cannot see is simply not shown.
const KEY = 'recentDevices';
const MAX = 5;

export const recentDeviceIds = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY));
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
};

export const rememberDevice = (id) => {
  if (!Number.isInteger(id)) {
    return;
  }
  const ids = [id, ...recentDeviceIds().filter((item) => item !== id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage full or blocked: the list is a convenience only.
  }
};
