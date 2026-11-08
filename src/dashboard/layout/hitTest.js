// Where would a dragged widget land? Pure geometry on measured rectangles.
//
// widgets: [{ id, left, top, right, bottom }]  (viewport px)
// rows:    [{ index, top, bottom }]              (visual rows in saved order)
// Result:  { kind: 'row', index } | { kind: 'beside', of, side } | { kind: 'stack', of, side }
//          | { kind: 'swap', with } | null

const ROW_ZONE = 14; // px around the boundary between two rows

export const hitTest = ({ x, y }, widgets, rows, direction = 'ltr', dragged = null) => {
  if (rows.length) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (y < first.top + ROW_ZONE / 2) {
      return { kind: 'row', index: 0 };
    }
    if (y > last.bottom - ROW_ZONE / 2) {
      return { kind: 'row', index: last.index + 1 };
    }
    for (let k = 0; k < rows.length - 1; k += 1) {
      const boundary = (rows[k].bottom + rows[k + 1].top) / 2;
      if (Math.abs(y - boundary) <= ROW_ZONE) {
        return { kind: 'row', index: rows[k + 1].index };
      }
    }
  }
  const target = widgets.find(
    (rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
  );
  if (!target || target.id === dragged) {
    return null;
  }
  const width = target.right - target.left;
  const height = target.bottom - target.top;
  const fx = (x - target.left) / width;
  const fy = (y - target.top) / height;
  const band = Math.min(0.25, 72 / width);
  if (fx < band || fx > 1 - band) {
    const physicalLeft = fx < band;
    const start = direction === 'rtl' ? !physicalLeft : physicalLeft;
    return { kind: 'beside', of: target.id, side: start ? 'start' : 'end' };
  }
  if (fy < 0.3) {
    return { kind: 'stack', of: target.id, side: 'top' };
  }
  if (fy > 0.7) {
    return { kind: 'stack', of: target.id, side: 'bottom' };
  }
  return { kind: 'swap', with: target.id };
};

export const sameTarget = (a, b) =>
  a === b ||
  (a &&
    b &&
    a.kind === b.kind &&
    a.index === b.index &&
    a.of === b.of &&
    a.side === b.side &&
    a.with === b.with);
