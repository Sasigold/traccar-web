import { makeStyles } from 'tss-react/mui';

const ROW = 30;

const useStyles = makeStyles()((theme) => ({
  root: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 2,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(72px, 40%) minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    minHeight: ROW - 2,
    paddingInline: theme.spacing(0.5),
    borderRadius: theme.tokens.radius.sm,
    outline: 'none',
    transition: `background-color ${theme.tokens.motion.duration.fast}ms`,
    '&:hover, &:focus-visible': {
      backgroundColor: theme.palette.action.hover,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${theme.palette.secondary.main}`,
    },
  },
  clickable: {
    cursor: 'pointer',
  },
  label: {
    ...theme.typography.body2,
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  track: {
    height: 12,
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  bar: {
    height: 12,
    minWidth: 2,
    // Rounded at the data end only; logical corners flip with the page direction.
    borderStartEndRadius: 4,
    borderEndEndRadius: 4,
    transition: `width ${theme.tokens.motion.duration.slow}ms ${theme.tokens.motion.easing.standard}`,
  },
  value: {
    ...theme.typography.body2,
    fontWeight: 600,
    color: theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    textAlign: 'end',
    minWidth: '3.5em',
  },
  more: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    paddingInline: theme.spacing(0.5),
  },
}));

// Ranked horizontal bars in HTML: one baseline at the inline start, the value at the
// tip. Rows that don't fit the height stay reachable in the table view.
const RankedBars = ({ view, height, onSelect, moreLabel }) => {
  const { classes, cx } = useStyles();
  const fit = Math.max(1, Math.floor((height + 2) / ROW));
  const visible = view.items.slice(0, view.items.length > fit ? fit - 1 : fit);
  const hidden = view.items.length - visible.length;
  const max = Math.max(...view.items.map((item) => Math.abs(item.value ?? 0)), 0) || 1;
  return (
    <ul className={classes.root}>
      {visible.map((item) => (
        <li
          key={item.key}
          className={cx(classes.row, onSelect && classes.clickable)}
          tabIndex={0}
          title={`${item.label}: ${item.full}`}
          aria-label={`${item.label}: ${item.full}`}
          onClick={onSelect ? () => onSelect(item) : undefined}
          onKeyDown={
            onSelect
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(item);
                  }
                }
              : undefined
          }
        >
          <span className={classes.label}>{item.label}</span>
          <span className={classes.track}>
            <span
              className={classes.bar}
              style={{
                width: `${(Math.abs(item.value ?? 0) / max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </span>
          <span className={classes.value} dir="ltr">
            {item.text}
          </span>
        </li>
      ))}
      {hidden > 0 && <li className={classes.more}>{moreLabel?.replace('{0}', hidden)}</li>}
    </ul>
  );
};

export default RankedBars;
