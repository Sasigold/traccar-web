import { Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme, { tone }) => {
  const accent = tone === 'danger' ? theme.palette.error.main : theme.palette.primary.main;
  return {
    // Direction A card: a titled header split from the body by a hairline.
    root: {
      borderRadius: theme.tokens.radius.lg,
      display: 'flex',
      flexDirection: 'column',
      ...(tone === 'danger' && {
        borderColor: alpha(theme.palette.error.main, 0.35),
      }),
    },
    header: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.75, 2.5),
      borderBottom: `1px solid ${theme.palette.surface.border}`,
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1.5, 2),
      },
    },
    icon: {
      width: 34,
      height: 34,
      flexShrink: 0,
      borderRadius: theme.tokens.radius.md,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tone === 'danger' ? alpha(accent, 0.1) : theme.palette.surface.tint,
      color: accent,
      '& svg': {
        fontSize: 20,
      },
    },
    titles: {
      flex: 1,
      minWidth: 0,
      // On phones a header action (e.g. "Add") wraps under the title instead of squeezing it.
      [theme.breakpoints.down('sm')]: {
        flexBasis: 'calc(100% - 48px)',
      },
    },
    title: {
      fontWeight: 600,
      color: tone === 'danger' ? theme.palette.error.main : theme.palette.text.primary,
    },
    body: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(2.25, 2.5, 2.5),
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(2),
      },
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
