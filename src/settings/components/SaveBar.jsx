import { Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { glass } from '../../common/theme/surfaces';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'sticky',
    bottom: 0,
    zIndex: 2,
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 3),
    ...glass(theme, 0.9),
    border: 'none',
    borderTop: `1px solid ${theme.palette.surface.border}`,
    boxShadow: 'none',
    [theme.breakpoints.down('md')]: {
      padding: theme.spacing(1.25, 2),
    },
    '@media print': {
      display: 'none',
    },
  },
  extra: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  button: {
    minWidth: 120,
  },
}));

// Sticky action bar for forms: cancel on the side, primary save at inline-end.
const SaveBar = ({
  onCancel,
  onSave,
  saving = false,
  disabled = false,
  saveLabel,
  cancelLabel,
  saveColor = 'primary',
  children,
}) => {
  const { classes } = useStyles();
  const t = useTranslation();
  return (
    <div className={classes.root}>
      {children && <div className={classes.extra}>{children}</div>}
      {onCancel && (
        <Button variant="outlined" color="inherit" className={classes.button} onClick={onCancel}>
          {cancelLabel || t('sharedCancel')}
        </Button>
      )}
      {onSave && (
        <Button
          variant="contained"
          color={saveColor}
          className={classes.button}
          onClick={onSave}
          loading={saving}
          disabled={disabled}
        >
          {saveLabel || t('sharedSave')}
        </Button>
      )}
    </div>
  );
};

export default SaveBar;
