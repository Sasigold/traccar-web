import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5, 1.5),
    minWidth: 0,
  },
  column: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    gap: theme.spacing(0.75),
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
  },
  button: {
    all: 'unset',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
    flex: 1,
    cursor: 'pointer',
    borderRadius: theme.tokens.radius.xs,
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.secondary.main}`,
      outlineOffset: 2,
    },
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    flexShrink: 0,
  },
  line: {
    width: 12,
    height: 2,
    borderRadius: 1,
    flexShrink: 0,
  },
  // REP-09: a dashed line, for a comparison series such as the period before.
  dashed: {
    width: 14,
    height: 0,
    borderTop: '2px dashed',
    flexShrink: 0,
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: 1,
  },
  value: {
    color: theme.palette.text.primary,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  share: {
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
    minWidth: '3.2em',
    textAlign: 'end',
  },
}));

// HTML legend (page direction, real text). Text keeps text colors; the colored mark
// beside it carries identity. `items`: [{ key, label, color, text?, share?, shape? }]
const ChartLegend = ({ items, shape = 'swatch', column = false, onSelect, className }) => {
  const { classes, cx } = useStyles();
  return (
    <ul className={cx(classes.list, column && classes.column, className)}>
      {items.map((item) => {
        const content = (
          <>
            {(item.shape ?? shape) === 'dashed' ? (
              <span className={classes.dashed} style={{ borderTopColor: item.color }} />
            ) : (
              <span
                className={(item.shape ?? shape) === 'line' ? classes.line : classes.swatch}
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className={classes.label} title={item.label}>
              {item.label}
            </span>
            {item.text != null && (
              <span className={classes.value} dir="ltr">
                {item.text}
              </span>
            )}
            {item.share != null && (
              <span className={classes.share} dir="ltr">
                {item.share}
              </span>
            )}
          </>
        );
        return (
          <li key={item.key} className={classes.item}>
            {onSelect ? (
              <button type="button" className={classes.button} onClick={() => onSelect(item)}>
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default ChartLegend;
