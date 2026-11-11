// ARC-12: when a new version of the app is taken in. Pure, so it is tested.
//
// A new service worker waits until it is let in. It is let in when someone asks (the button),
// or by itself when nobody is in the middle of something: the tab is hidden, or nobody has
// touched it for IDLE_MS, and no form has unsaved changes. Once it is in, every open tab hears
// about it; only the tab that let it in, or a hidden tab without unsaved changes, reloads at
// once. The others say a new version is ready and reload when asked, so an update in one tab
// never wipes a form in another.

export const IDLE_MS = 10 * 60 * 1000;

export const shouldApplyUpdate = ({ hidden, idleMs, dirty }) =>
  !dirty && (hidden || idleMs >= IDLE_MS);

export const shouldReloadAfterUpdate = ({ initiated, hidden, dirty }) =>
  initiated || (hidden && !dirty);
