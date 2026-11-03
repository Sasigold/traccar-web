import { Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';

const useStyles = makeStyles()((theme, { compact }) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(compact ? 3 : 6, 3),
    color: theme.palette.text.secondary,
  },
  icon: {
    width: compact ? 44 : 56,
    height: compact ? 44 : 56,
    borderRadius: compact ? 14 : 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(0.5),
    '& svg': {
      fontSize: compact ? 22 : 28,
    },
  },
  title: {
    color: theme.palette.text.primary,
    fontWeight: 700,
  },
  action: {
    marginTop: theme.spacing(1),
  },
}));

const EmptyState = ({ icon, title, description, action, compact = false, className }) => {
  const { classes, cx } = useStyles({ compact });
  return (
    <div className={cx(classes.root, className)}>
      <span className={classes.icon}>{icon || <InboxRoundedIcon />}</span>
      {title && (
        <Typography variant={compact ? 'subtitle2' : 'subtitle1'} className={classes.title}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body2" color="textSecondary">
          {description}
        </Typography>
      )}
      {action && <div className={classes.action}>{action}</div>}
    </div>
  );
};

export default EmptyState;
