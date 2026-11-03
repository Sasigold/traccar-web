import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  handle: {
    height: 14,
    cursor: 'ns-resize',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    '&:hover $pill, &:active $pill': {
      backgroundColor: theme.palette.primary.main,
    },
    '@media print': {
      display: 'none',
    },
  },
  pill: {
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: theme.palette.surface.borderStrong,
    transition: 'background-color 140ms ease',
  },
}));

const ResizeHandle = () => {
  const { classes } = useStyles();

  const onPointerDown = (event) => {
    event.preventDefault();
    const containerRectangle = event.currentTarget.parentElement.getBoundingClientRect();

    const onMove = (moveEvent) => {
      const offset = moveEvent.clientY - containerRectangle.top;
      const percentage = Math.max(10, Math.min(90, (offset / containerRectangle.height) * 100));
      document.documentElement.style.setProperty('--report-map-height', `${percentage}%`);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className={classes.handle} onPointerDown={onPointerDown}>
      <span className={classes.pill} />
    </div>
  );
};

export default ResizeHandle;
