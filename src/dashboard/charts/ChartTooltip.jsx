import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    minWidth: 120,
    maxWidth: 260,
    padding: theme.spacing(1, 1.25),
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    boxShadow: theme.shadows[2],
    color: theme.palette.text.primary,
    pointerEvents: 'none',
  },
  title: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    '& + &': {
      marginTop: theme.spacing(0.25),
    },
  },
  key: {
    width: 12,
    height: 2,
    borderRadius: 1,
    flexShrink: 0,
  },
  value: {
    ...theme.typography.subtitle2,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  label: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  note: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
}));

// Tooltip card: the value leads, the series name follows, keyed by a short line in
// the series color. `rows`: [{ key, color, text, label }]
export const TooltipCard = ({ title, rows, note }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.root} dir={document.documentElement.dir || 'ltr'}>
      {title && <div className={classes.title}>{title}</div>}
      {rows.map((row) => (
        <div key={row.key} className={classes.row}>
          {row.color && <span className={classes.key} style={{ backgroundColor: row.color }} />}
          <span className={classes.value} dir="ltr">
            {row.text}
          </span>
          {row.label && <span className={classes.label}>{row.label}</span>}
        </div>
      ))}
      {note && <div className={classes.note}>{note}</div>}
    </div>
  );
};

export default TooltipCard;
