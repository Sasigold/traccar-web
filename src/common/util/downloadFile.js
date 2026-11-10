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

export default downloadFile;
