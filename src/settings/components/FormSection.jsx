import { Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme, { tone }) => {
  const accent = tone === 'danger' ? theme.palette.error.main : theme.palette.primary.main;
  return {
    root: {
      borderRadius: theme.tokens.radius.xl,
      padding: theme.spacing(2.5, 3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      ...(tone === 'danger' && {
        borderColor: alpha(theme.palette.error.main, 0.35),
      }),
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2),
      },
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
    },
    icon: {
      width: 34,
      height: 34,
      flexShrink: 0,
      borderRadius: theme.tokens.radius.md,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: alpha(accent, 0.1),
      color: accent,
      '& svg': {
        fontSize: 20,
      },
    },
    titles: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontWeight: 700,
      color: tone === 'danger' ? theme.palette.error.main : theme.palette.text.primary,
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    },
  };
});

// A titled card that groups related form fields.
const FormSection = ({ id, title, description, icon, actions, tone = 'default', children }) => {
  const { classes } = useStyles({ tone });
  return (
    <Paper id={id} elevation={0} className={classes.root} component="section">
      {(title || actions) && (
        <div className={classes.header}>
          {icon && <span className={classes.icon}>{icon}</span>}
          <div className={classes.titles}>
            {title && (
              <Typography variant="subtitle1" className={classes.title}>
                {title}
              </Typography>
            )}
            {description && (
              <Typography variant="body2" color="textSecondary">
                {description}
              </Typography>
            )}
          </div>
          {actions}
        </div>
      )}
      <div className={classes.body}>{children}</div>
    </Paper>
  );
};

export default FormSection;
