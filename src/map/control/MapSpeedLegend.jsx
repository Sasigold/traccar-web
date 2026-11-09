import { useEffect } from 'react';
import { useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { map } from '../core/MapView';
import { SPEED_RAMP, overspeedColor } from '../../common/util/colors';
import { speedFromKnots, speedUnitString } from '../../common/util/converter';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAttributePreference } from '../../common/util/preferences';

const useStyles = makeStyles()((theme) => ({
  // The five speed steps side by side (flat, no gradient), then the overspeed swatch.
  colorBar: {
    display: 'flex',
    height: 10,
    gap: 1,
    marginBottom: 2,
    '& > span': {
      flex: 1,
      borderRadius: 1,
    },
  },
  overspeed: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    '& > span:first-of-type': {
      width: 10,
      height: 10,
      borderRadius: 1,
    },
  },
  label: {
    color: theme.palette.text.primary,
  },
}));

const MapSpeedLegend = ({ positions, speedLimit = 0 }) => {
  const theme = useTheme();
  const t = useTranslation();
  const speedUnit = useAttributePreference('speedUnit');
  const { classes } = useStyles();

  useEffect(() => {
    if (!positions.length) return undefined;
    const maxSpeed = positions.reduce((a, p) => Math.max(a, p.speed), -Infinity);
    const minSpeed = positions.reduce((a, p) => Math.min(a, p.speed), Infinity);
    if (!maxSpeed) return undefined;

    let container;
    const control = {
      onAdd: () => {
        container = document.createElement('div');
        container.className = 'maplibregl-ctrl maplibregl-ctrl-scale';
        // Slow to fast reads left to right, like the "min - max" range under it.
        container.dir = 'ltr';
        const dark = theme.palette.mode === 'dark';
        const colorBar = document.createElement('div');
        colorBar.className = classes.colorBar;
        colorBar.setAttribute('aria-hidden', 'true');
        (dark ? SPEED_RAMP.dark : SPEED_RAMP.light).forEach((color) => {
          const step = document.createElement('span');
          step.style.backgroundColor = color;
          colorBar.appendChild(step);
        });
        const label = document.createElement('span');
        label.className = classes.label;
        const min = Math.round(speedFromKnots(minSpeed, speedUnit));
        const max = Math.round(speedFromKnots(maxSpeed, speedUnit));
        label.textContent = `${min} - ${max} ${speedUnitString(speedUnit, t)}`;
        container.appendChild(colorBar);
        container.appendChild(label);
        if (speedLimit > 0 && maxSpeed > speedLimit) {
          const overspeed = document.createElement('div');
          overspeed.className = classes.overspeed;
          const swatch = document.createElement('span');
          swatch.style.backgroundColor = overspeedColor(dark);
          const text = document.createElement('span');
          text.textContent = t('mapOverSpeedLimit');
          overspeed.appendChild(swatch);
          overspeed.appendChild(text);
          container.appendChild(overspeed);
        }
        return container;
      },
      onRemove: () => container?.remove(),
    };
    map.addControl(control, theme.direction === 'rtl' ? 'bottom-right' : 'bottom-left');
    return () => map.removeControl(control);
  }, [positions, speedUnit, speedLimit, t, theme, classes]);

  return null;
};

export default MapSpeedLegend;
