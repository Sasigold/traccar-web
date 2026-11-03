import {
  aqua,
  brandColors,
  chartColors,
  chrome,
  mapColors,
  navy,
  status,
  surfaces,
} from './tokens';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

// Light mode: navy is the foreground primary (text, focus, selection) and aqua
// is the accent / main-action color. Dark mode: aqua takes over as primary
// because navy has no contrast on dark surfaces.
// Server attributes colorPrimary / colorSecondary can still override the brand.
export default (server, darkMode) => {
  const mode = darkMode ? 'dark' : 'light';
  const surface = surfaces[mode];
  const colors = status[mode];

  const primaryOverride = validatedColor(server?.attributes?.colorPrimary);
  const secondaryOverride = validatedColor(server?.attributes?.colorSecondary);

  const primary = primaryOverride
    ? { main: primaryOverride }
    : darkMode
      ? { main: brandColors.aqua, light: aqua[300], dark: aqua[600], contrastText: brandColors.ink }
      : {
          main: brandColors.navy,
          light: navy[600],
          dark: brandColors.ink,
          contrastText: brandColors.white,
        };

  const secondary = secondaryOverride
    ? { main: secondaryOverride }
    : { main: brandColors.aqua, light: aqua[300], dark: aqua[600], contrastText: brandColors.ink };

  return {
    mode,
    background: {
      default: surface.canvas,
      paper: surface.paper,
    },
    primary,
    secondary,
    // Main call-to-action fill (brand: "aqua for main actions", dark type on aqua).
    cta: {
      main: brandColors.aqua,
      hover: aqua[600],
      contrastText: brandColors.ink,
    },
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
      main: darkMode ? mapColors.geometryDark : mapColors.geometryLight,
    },
    alwaysDark: {
      main: brandColors.ink,
    },
    brand: brandColors,
    chrome,
    surface,
    chart: chartColors[mode],
  };
};
