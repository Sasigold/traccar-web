// ADM-24: number fields that do not change under the mouse wheel and do not take "e" or "+"
// (the browser accepts 1e5). Installed once for the whole app.
const isNumberInput = (element) => element?.tagName === 'INPUT' && element.type === 'number';

export const REJECTED_KEYS = new Set(['e', 'E', '+']);

export const installNumberInputGuards = (doc = document) => {
  const onWheel = (event) => {
    // A focused number field under the wheel loses focus, so the page scrolls instead.
    if (isNumberInput(event.target) && doc.activeElement === event.target) {
      event.target.blur();
    }
  };
  const onKeyDown = (event) => {
    if (isNumberInput(event.target) && REJECTED_KEYS.has(event.key)) {
      event.preventDefault();
    }
  };
  doc.addEventListener('wheel', onWheel, { passive: true });
  doc.addEventListener('keydown', onKeyDown);
  return () => {
    doc.removeEventListener('wheel', onWheel);
    doc.removeEventListener('keydown', onKeyDown);
  };
};
