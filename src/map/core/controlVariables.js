import { alpha } from '@mui/material/styles';

// The colors mapControls.css gives the map's own controls (zoom, attribution, layers), from the
// theme. Set on the element around a map.
/** @param {any} theme */
const mapControlVariables = (theme) => {
  const dark = theme.palette.mode === 'dark';
  return {
    '--map-ctrl-bg': theme.palette.background.paper,
    '--map-ctrl-border': theme.palette.surface.border,
    '--map-ctrl-divider': theme.palette.surface.border,
    '--map-ctrl-hover': alpha(theme.palette.primary.main, 0.1),
    '--map-ctrl-fg': theme.palette.text.primary,
    '--map-ctrl-accent': theme.palette.primary.main,
    '--map-ctrl-icon-filter': dark ? 'invert(1) brightness(1.1)' : 'none',
    '--map-ctrl-shadow': theme.shadows[3],
  };
};

export default mapControlVariables;
