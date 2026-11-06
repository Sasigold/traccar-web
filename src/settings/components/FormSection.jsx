import { Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';

// A dropdown field (MUI Select or TextField select) inside a section.
const selectRow = '.MuiFormControl-root:has(> .MuiInputBase-root .MuiSelect-select)';

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
      // Direction A on phones: a dropdown reads as one setting row, the name on one side
      // and the current value with its arrow on the other.
      [theme.breakpoints.down('md')]: {
        [`& ${selectRow}`]: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: theme.spacing(1.5),
          minHeight: 48,
          '& > .MuiInputLabel-root': {
            position: 'static',
            transform: 'none',
            flex: '1 1 0',
            minWidth: 0,
            maxWidth: 'none',
            whiteSpace: 'normal',
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: theme.palette.text.primary,
          },
          '& > .MuiInputBase-root': {
            flex: '0 1 auto',
            maxWidth: '58%',
            borderRadius: theme.tokens.radius.md,
            backgroundColor: 'transparent',
            '& fieldset': {
              border: 0,
            },
            '& .MuiSelect-select': {
              paddingBlock: theme.spacing(1),
              paddingInlineStart: theme.spacing(1),
              textAlign: 'end',
              color: theme.palette.text.secondary,
              fontSize: '0.875rem',
            },
            '&.Mui-focused': {
              backgroundColor: theme.palette.surface.tint,
            },
          },
          '& > .MuiFormHelperText-root': {
            flexBasis: '100%',
            marginInline: 0,
            marginTop: 0,
          },
        },
        [`& ${selectRow} + ${selectRow}`]: {
          borderTop: `1px solid ${theme.palette.surface.border}`,
          paddingTop: theme.spacing(1),
        },
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
