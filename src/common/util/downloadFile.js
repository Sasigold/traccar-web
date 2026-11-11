import fetchOrThrow from './fetchOrThrow';

// Saves a Blob under the given name, through a temporary link (keeps the name in every browser,
// unlike file-saver's fallbacks).
const downloadFile = (name, blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadJson = (name, value) =>
  downloadFile(name, new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));

// REP-22: a server file (such as api/positions/kml) fetched and saved, so an error shows as a
// message instead of replacing the app with the server's error page.
export const downloadUrl = async (url, fallbackName) => {
  const response = await fetchOrThrow(url);
  const disposition = response.headers.get('Content-Disposition') || '';
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  downloadFile(name, await response.blob());
};

export default downloadFile;
