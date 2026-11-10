import { Alert, Button, Snackbar } from '@mui/material';
import { useSelector } from 'react-redux';
import { useEffect, useRef, useState } from 'react';
import { Workbox } from 'workbox-window';
import { useTranslation } from './common/components/LocalizationProvider';
import { hasUnsavedChanges } from './common/components/confirm/unsavedChanges';
import { shouldApplyUpdate, shouldReloadAfterUpdate } from './common/util/updatePolicy';

const CHECK_MS = 30000;

// ARC-12: a new version waits for a good moment (updatePolicy.js): the button, or a hidden or
// idle tab without unsaved changes. A tab that did not ask reloads only when nothing would be
// lost; otherwise it says the new version is ready. Every tab hears the new worker take over
// (`controlling`), so the tabs agree without messaging each other.
const UpdateController = () => {
  const t = useTranslation();

  const updateInterval = useSelector(
    (state) => state.session.server.attributes.serviceWorkerUpdateInterval || 3600000,
  );

  const [waitingWorker, setWaitingWorker] = useState(null);
  const [ready, setReady] = useState(false);
  const initiatedRef = useRef(false);
  const lastInputRef = useRef(0);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
      return undefined;
    }

    const url = new URL('sw.js', document.baseURI).href;
    const workbox = new Workbox(url, { scope: document.baseURI });
    const onWaiting = () => setWaitingWorker(workbox);
    const onControlling = (event) => {
      if (!event.isUpdate) return;
      setWaitingWorker(null);
      const state = {
        initiated: initiatedRef.current,
        hidden: document.visibilityState === 'hidden',
        dirty: hasUnsavedChanges(),
      };
      if (shouldReloadAfterUpdate(state)) {
        window.location.reload();
      } else {
        setReady(true);
      }
    };
    workbox.addEventListener('waiting', onWaiting);
    workbox.addEventListener('controlling', onControlling);

    let interval;
    let disposed = false;
    workbox
      .register({ immediate: true })
      .then((registration) => {
        if (!disposed && registration) {
          interval = setInterval(async () => {
            if (!registration.installing && navigator.onLine) {
              const response = await fetch(url, { cache: 'no-store' });
              if (response.ok) {
                await registration.update();
              }
            }
          }, updateInterval);
        }
      })
      .catch(console.error);

    return () => {
      disposed = true;
      clearInterval(interval);
      workbox.removeEventListener('waiting', onWaiting);
      workbox.removeEventListener('controlling', onControlling);
    };
  }, [updateInterval]);

  // Waiting or ready: take the update in (or reload) at the next good moment.
  useEffect(() => {
    if (!waitingWorker && !ready) return undefined;
    lastInputRef.current = Date.now();
    const touch = () => {
      lastInputRef.current = Date.now();
    };
    const check = () => {
      const state = {
        hidden: document.visibilityState === 'hidden',
        idleMs: Date.now() - lastInputRef.current,
        dirty: hasUnsavedChanges(),
      };
      if (!shouldApplyUpdate(state)) return;
      if (waitingWorker) {
        initiatedRef.current = true;
        waitingWorker.messageSkipWaiting();
      } else {
        window.location.reload();
      }
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, CHECK_MS);
    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, [waitingWorker, ready]);

  const apply = () => {
    if (waitingWorker) {
      initiatedRef.current = true;
      waitingWorker.messageSkipWaiting();
    } else {
      window.location.reload();
    }
  };

  return (
    <Snackbar open={Boolean(waitingWorker) || ready}>
      <Alert
        elevation={6}
        severity="info"
        variant="filled"
        action={
          <Button color="inherit" size="small" onClick={apply}>
            {ready ? t('updateReload') : t('updateNow')}
          </Button>
        }
      >
        {ready ? t('updateReady') : t('settingsUpdateAvailable')}
      </Alert>
    </Snackbar>
  );
};

export default UpdateController;
