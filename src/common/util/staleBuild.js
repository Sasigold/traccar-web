// Tabs left open across a deploy (FND-05): their index.html names chunks of the previous build. The
// deploy keeps old chunks for a while, but a tab older than that, or a chunk that failed to load,
// would show an error. Instead the page reloads once to pick up the new build; a second failure
// within a minute shows the error as usual, so a real outage never loops.

import { countEvent } from '../telemetry/metrics';

const KEY = 'vfStaleReloadAt';
const WINDOW = 60000;

// Errors browsers give for a dynamic import whose file is gone or failed to load.
export const isChunkLoadError = (error) =>
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(
    `${error?.name || ''} ${error?.message || error || ''}`,
  );

// Reloads unless it already did within the last minute. Returns whether it reloads.
export const reloadForNewBuild = ({ storage, reload, now = Date.now() }) => {
  let last;
  try {
    last = Number(storage?.getItem(KEY)) || 0;
  } catch {
    last = 0;
  }
  if (last && now - last < WINDOW) {
    return false;
  }
  try {
    storage?.setItem(KEY, String(now));
  } catch {
    // Without storage it still reloads once; the next failure shows the error page.
    return false;
  }
  reload();
  return true;
};

// Vite fires vite:preloadError when a lazy page's file cannot be loaded.
export const installStaleBuildRecovery = (target = window) => {
  target.addEventListener('vite:preloadError', (event) => {
    countEvent('chunk_load_error');
    if (
      reloadForNewBuild({
        storage: target.sessionStorage,
        reload: () => target.location.reload(),
      })
    ) {
      event.preventDefault();
    }
  });
};
