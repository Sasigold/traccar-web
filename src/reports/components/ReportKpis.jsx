import KpiTile from '../../common/components/KpiTile';
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
}));

// Row of summary tiles above a report table (ADM-29: the shared KpiTile). items: [{ key, label, value, icon, hint }]
const ReportKpis = ({ items }) => {
  const { classes } = useStyles();
  const visible = items.filter((item) => item.value != null && item.value !== '');
  if (!visible.length) {
    return null;
  }
  return (
    <div className={classes.root}>
      {visible.map((item) => (
        <KpiTile
          key={item.key}
          layout="inline"
          size="sm"
          icon={item.icon}
          label={item.label}
          value={item.value}
          hint={item.hint}
        />
      ))}
    </div>
  );
};

export default ReportKpis;
