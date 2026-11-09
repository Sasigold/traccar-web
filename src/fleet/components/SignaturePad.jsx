import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
    width: '100%',
  },
  canvas: {
    width: '100%',
    maxWidth: 420,
    height: 160,
    border: `1px solid ${theme.palette.surface.border}`,
    borderRadius: theme.tokens.radius.md,
    backgroundColor: theme.palette.background.paper,
    touchAction: 'none',
    cursor: 'crosshair',
  },
}));

// ADM-11: a signature drawn with a finger, a pen or the mouse. onChange(Blob | null) with a PNG of
// the strokes, or null when cleared.
const SignaturePad = ({ label, onChange }) => {
  const { classes, theme } = useStyles();
  const t = useTranslation();
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.lineWidth = 2.5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = theme.palette.text.primary;
  }, [theme]);

  const point = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };

  const start = (event) => {
    event.preventDefault();
    canvasRef.current.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    const context = canvasRef.current.getContext('2d');
    context.beginPath();
    context.moveTo(...point(event));
  };

  const move = (event) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current.getContext('2d');
    context.lineTo(...point(event));
    context.stroke();
    setEmpty(false);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current.toBlob((blob) => onChange(blob), 'image/png');
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className={classes.root}>
      <canvas
        ref={canvasRef}
        className={classes.canvas}
        role="img"
        aria-label={empty ? label : `${label}: ${t('fleetSignatureSigned')}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <Button size="small" onClick={clear} disabled={empty}>
        {t('fleetSignatureClear')}
      </Button>
    </div>
  );
};

export default SignaturePad;
