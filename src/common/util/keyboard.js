// A single-key shortcut on the map screen (Esc, 0) applies only when no dialog, menu or text
// field has the keyboard.
export const shortcutAllowed = (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  if (document.querySelector('.MuiModal-root:not(.MuiModal-hidden)')) {
    return false;
  }
  const target = event.target;
  return !(
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
};
