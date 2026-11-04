import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { Link } from 'react-router-dom';

const useStyles = makeStyles()((theme, { tone }) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    padding: theme.spacing(2, 2.25),
    borderRadius: theme.tokens.radius.lg,
    backgroundColor: theme.palette.surface.tint,
    border: `1px solid ${theme.palette.surface.border}`,
    color: theme.palette.text.primary,
    textDecoration: 'none',
    minWidth: 0,
    transition: `border-color ${theme.tokens.motion.duration.fast}ms`,
    '&[href]:hover': {
      borderColor: theme.palette.surface.borderStrong,
    },
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    color: theme.palette.surface.textSecondaryOnTint,
    '& svg': {
      fontSize: 20,
      color: tone === 'alert' ? theme.palette.error.main : theme.palette.primary.main,
    },
  },
  label: {
    fontWeight: 600,
    color: theme.palette.surface.textSecondaryOnTint,
  },
  value: {
    ...theme.typography.h2,
    color: tone === 'alert' ? theme.palette.error.main : theme.palette.text.primary,
    fontVariantNumeric: 'tabular-nums',
  },
  hint: {
    color: theme.palette.surface.textSecondaryOnTint,
  },
}));

// Ice KPI tile (brand book: KPI cards sit on ice). Links when `to` is set.
const KpiTile = ({ icon, label, value, hint, to, tone = 'default' }) => {
  const { classes } = useStyles({ tone });
  const props = to ? { component: Link, to } : { component: 'div' };
  const Root = props.component;
  return (
    <Root className={classes.root} {...(to ? { to } : {})}>
      <span className={classes.head}>
        {icon}
        <Typography variant="body2" className={classes.label} noWrap>
          {label}
        </Typography>
      </span>
      <span className={classes.value}>{value}</span>
      {hint && (
        <Typography variant="caption" className={classes.hint} noWrap>
          {hint}
        </Typography>
      )}
    </Root>
  );
};

export default KpiTile;
