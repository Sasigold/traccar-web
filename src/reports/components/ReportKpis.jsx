import { Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: theme.spacing(1.5),
    margin: theme.spacing(0, 3, 1.5),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(0, 2, 1.5),
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
    '@media print': {
      margin: theme.spacing(0, 0, 2),
    },
  },
  tile: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderRadius: theme.tokens.radius.lg,
    border: `1px solid ${theme.palette.surface.border}`,
    backgroundColor: theme.palette.background.paper,
    minWidth: 0,
  },
  icon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: theme.tokens.radius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    color: theme.palette.primary.main,
    '& svg': {
      fontSize: 20,
    },
  },
  text: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  value: {
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}));

// Row of summary tiles above a report table. items: [{ key, label, value, icon }]
const ReportKpis = ({ items }) => {
  const { classes } = useStyles();
  const visible = items.filter((item) => item.value != null && item.value !== '');
  if (!visible.length) {
    return null;
  }
  return (
    <div className={classes.root}>
      {visible.map((item) => (
        <div key={item.key} className={classes.tile}>
          {item.icon && <span className={classes.icon}>{item.icon}</span>}
          <div className={classes.text}>
            <Typography variant="h6" className={classes.value}>
              {item.value}
            </Typography>
            <Typography variant="caption" color="textSecondary" className={classes.label}>
              {item.label}
            </Typography>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReportKpis;
