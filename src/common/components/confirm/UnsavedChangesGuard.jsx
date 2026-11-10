import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../LocalizationProvider';
import { useConfirm } from './ConfirmProvider';
import {
  hasBackSentinel,
  hasUnsavedChanges,
  onUnsavedChange,
  setBackSentinel,
  useLeaveGuard,
} from './unsavedChanges';

// ADM-05: asks before links and the browser's back button leave a form with unsaved changes.
// (The app uses BrowserRouter, which has no navigation blocker: links are caught on click, and
// the back button by a history entry added while a form has changes.)
const UnsavedChangesGuard = () => {
  const t = useTranslation();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const guard = useLeaveGuard(confirm, t);

  // Links inside the app.
  useEffect(() => {
    const onClick = (event) => {
      if (!hasUnsavedChanges() || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href]');
      if (
        !anchor ||
        (anchor.target && anchor.target !== '_self') ||
        anchor.hasAttribute('download')
      ) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      const base = new URL(document.baseURI).pathname.replace(/\/$/, '');
      const path = url.pathname.startsWith(base)
        ? url.pathname.slice(base.length) || '/'
        : url.pathname;
      guard(() => navigate(`${path}${url.search}${url.hash}`));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [guard, navigate]);

  // The browser's back button: while a form has changes, one extra history entry absorbs the
  // first "back", so the app can ask before really going back.
  useEffect(() => {
    const unsubscribe = onUnsavedChange((dirty) => {
      if (dirty && !hasBackSentinel()) {
        setBackSentinel(true);
        window.history.pushState(window.history.state, '', window.location.href);
      }
    });
    const onPopState = () => {
      if (!hasBackSentinel()) return;
      setBackSentinel(false);
      if (!hasUnsavedChanges()) return;
      guard(() => window.history.back()).then(() => {
        if (hasUnsavedChanges()) {
          setBackSentinel(true);
          window.history.pushState(window.history.state, '', window.location.href);
        }
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      unsubscribe();
      window.removeEventListener('popstate', onPopState);
    };
  }, [guard]);

  return null;
};

export default UnsavedChangesGuard;
