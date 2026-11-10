// LIV-17: files handed from one screen to the next (a video frame to a new incident report),
// kept in memory for the next screen to take once.
const pending = new Map();

export const putPendingFiles = (key, files) => pending.set(key, files);

export const takePendingFiles = (key) => {
  const files = pending.get(key) || [];
  pending.delete(key);
  return files;
};
