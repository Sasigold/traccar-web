import { Fab } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  fab: {
    position: 'fixed',
    bottom: 'calc(16px + var(--shell-bottom, 0px))',
    insetInlineEnd: theme.spacing(2),
    zIndex: theme.layers.floating,
    '@media print': {
      display: 'none',
    },
  },
}));

const BaseFab = ({ children, color = 'primary', onClick, label, pressed }) => {
  const { classes } = useStyles();

  return (
    <div className={classes.fab}>
      <Fab size="medium" color={color} onClick={onClick} aria-label={label} aria-pressed={pressed}>
        {children}
      </Fab>
    </div>
  );
};

export default BaseFab;
