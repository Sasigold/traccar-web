import { useEffect, useRef } from 'react';
import { Table, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  // Phone layout: every row becomes a card and every cell a "label: value" line.
  // Labels come from the header cells (copied into data-label by the effect below).
  stacked: {
    minWidth: '0 !important',
    '&, & > tbody, & > tfoot, & > tbody > tr, & > tfoot > tr': {
      display: 'block',
      width: '100%',
    },
    '& > thead': {
      display: 'none',
    },
    '& > tbody, & > tfoot': {
      padding: theme.spacing(1, 1.5),
    },
    '& > tbody > tr, & > tfoot > tr': {
      position: 'relative',
      marginBottom: theme.spacing(1.25),
      padding: theme.spacing(0.75, 0),
      borderRadius: theme.tokens.radius.lg,
      border: `1px solid ${theme.palette.surface.border}`,
      backgroundColor: theme.palette.background.paper,
    },
    '& > tbody > tr > td, & > tfoot > tr > td, & > tfoot > tr > th': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1.5),
      width: 'auto !important',
      minHeight: 36,
      border: 'none',
      paddingBlock: `${theme.spacing(0.5)} !important`,
      paddingInline: `${theme.spacing(1.75)} !important`,
      textAlign: 'end',
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
    },
    '& > tbody > tr > td[data-label]::before, & > tfoot > tr > td[data-label]::before': {
      content: 'attr(data-label)',
      flexShrink: 0,
      maxWidth: '45%',
      textAlign: 'start',
      fontSize: '0.75rem',
      fontWeight: 600,
      color: theme.palette.text.secondary,
    },
    // The first labelled cell is the card title (usually the name), shown without its label.
    '& > tbody > tr > td[data-first]': {
      justifyContent: 'flex-start',
      textAlign: 'start',
      fontWeight: 600,
      fontSize: '0.9375rem',
      '&::before': {
        display: 'none',
      },
    },
    '& > tbody > tr[data-actions] > td[data-first]': {
      paddingInlineEnd: `${theme.spacing(6)} !important`,
    },
    // Row actions (the last cell without a header) float in the card's top corner.
    '& > tbody > tr > td[data-actions]': {
      position: 'absolute',
      insetBlockStart: theme.spacing(0.75),
      insetInlineEnd: 0,
      minHeight: 0,
      paddingInline: `${theme.spacing(0.5)} !important`,
    },
    // Actions revealed on hover in the grid stay visible on cards.
    '& > tbody > tr > td[data-actions] > *': {
      opacity: 1,
    },
    // Cells without a header (row actions, checkboxes) sit at the end of the card.
    '& > tbody > tr > td:not([data-label])': {
      justifyContent: 'flex-end',
    },
    '& > tbody > tr > td[data-empty]': {
      display: 'none',
    },
  },
}));

const headerLabels = (table) => {
  const row = table.tHead?.rows[table.tHead.rows.length - 1];
  const labels = [];
  if (row) {
    Array.from(row.cells).forEach((cell) => {
      const text = cell.textContent.trim();
      for (let i = 0; i < (cell.colSpan || 1); i += 1) {
        labels.push(text);
      }
    });
  }
  return labels;
};

const setAttr = (element, name, value) => {
  if (value == null) {
    if (element.hasAttribute(name)) element.removeAttribute(name);
  } else if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
};

const labelCells = (table) => {
  const labels = headerLabels(table);
  const sections = [...table.tBodies, ...(table.tFoot ? [table.tFoot] : [])];
  sections.forEach((section) => {
    Array.from(section.rows).forEach((row) => {
      let column = 0;
      let first = true;
      const cells = Array.from(row.cells);
      const last = cells[cells.length - 1];
      const actions =
        cells.length > 1 &&
        !labels[labels.length - 1] &&
        (last?.colSpan || 1) === 1 &&
        Boolean(last?.querySelector('button'));
      setAttr(row, 'data-actions', actions ? '' : null);
      cells.forEach((cell) => {
        const span = cell.colSpan || 1;
        const label = span === 1 ? labels[column] : null;
        setAttr(cell, 'data-label', label || null);
        const isFirst = Boolean(label) && first;
        setAttr(cell, 'data-first', isFirst ? '' : null);
        if (label) first = false;
        const empty =
          Boolean(label) &&
          !cell.textContent.trim() &&
          !cell.querySelector('svg, img, input, button, .MuiSkeleton-root');
        setAttr(cell, 'data-empty', empty ? '' : null);
        setAttr(cell, 'data-actions', actions && cell === last ? '' : null);
        column += span;
      });
    });
  });
};

// Drop-in replacement for MUI <Table>. On phones and tablets the table is shown as a list of
// cards (one per row) instead of a wide table that needs horizontal scrolling.
// Pass responsive={false} for tables that must stay a grid.
const ResponsiveTable = ({ responsive = true, className, style, ref: externalRef, ...props }) => {
  const { classes, cx } = useStyles();
  const theme = useTheme();
  // Same breakpoint where the app switches to its mobile navigation (phones and tablets).
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const stacked = responsive && compact;
  const ref = useRef(null);

  useEffect(() => {
    const table = ref.current;
    if (!stacked || !table) return undefined;
    labelCells(table);
    let frame;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => labelCells(table));
    });
    observer.observe(table, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [stacked]);

  const setRef = (node) => {
    ref.current = node;
    if (typeof externalRef === 'function') externalRef(node);
    else if (externalRef) externalRef.current = node;
  };

  return (
    <Table
      ref={setRef}
      className={cx(className, stacked && classes.stacked)}
      style={stacked ? undefined : style}
      {...props}
      stickyHeader={stacked ? false : props.stickyHeader}
    />
  );
};

export default ResponsiveTable;
