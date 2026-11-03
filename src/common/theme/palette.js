import { brand, navy, signal, slate, status, surfaces, violet } from './tokens';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

export { brand };

// Server attributes colorPrimary / colorSecondary still override the brand.
export default (server, darkMode) => {
  const mode = darkMode ? 'dark' : 'light';
  const surface = surfaces[mode];
  const colors = status[mode];

  const primaryOverride = validatedColor(server?.attributes?.colorPrimary);
  const secondaryOverride = validatedColor(server?.attributes?.colorSecondary);

  const primary = primaryOverride
    ? { main: primaryOverride }
    : darkMode
      ? { main: navy[400], light: navy[300], dark: navy[500], contrastText: '#050b16' }
      : { main: navy[600], light: navy[400], dark: navy[700], contrastText: '#ffffff' };

  const secondary = secondaryOverride
    ? { main: secondaryOverride }
    : darkMode
      ? { main: signal[400], light: signal[300], dark: signal[500], contrastText: '#050b16' }
      : { main: signal[500], light: signal[400], dark: signal[600], contrastText: '#ffffff' };

  return {
    mode,
    background: {
      default: surface.canvas,
      paper: surface.paper,
    },
    primary,
    secondary,
    success: { main: colors.success },
    warning: { main: colors.warning },
    error: { main: colors.error },
    info: { main: colors.info },
    text: {
      primary: surface.textPrimary,
      secondary: surface.textSecondary,
      disabled: surface.textDisabled,
    },
    divider: surface.border,
    neutral: {
      main: colors.neutral,
    },
    geometry: {
      main: signal[500],
    },
    alwaysDark: {
      main: slate[900],
    },
    surface,
    gradient: {
      start: primary.main,
      end: secondary.main,
    },
    chart: [
      primary.main,
      secondary.main,
      darkMode ? violet[400] : violet[500],
      colors.warning,
      colors.success,
      colors.error,
      surface.textSecondary,
    ],
  };
};
