// The reports opened last, newest first, for the top of the reports page (REP-02). Only the
// report ids are kept; one that is no longer available is simply not shown.
const KEY = 'recentReports';
const MAX = 3;

export const recentReportIds = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY));
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const rememberReport = (id) => {
  if (typeof id !== 'string' || !id) {
    return;
  }
  const ids = [id, ...recentReportIds().filter((item) => item !== id)].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Storage full or blocked: the list is a convenience only.
  }
};
