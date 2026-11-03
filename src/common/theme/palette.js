import { grey } from '@mui/material/colors';

const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

// Brand palette: deep teal primary, warm amber secondary.
// Server attributes colorPrimary / colorSecondary still override these.
export const brand = {
  primaryLight: '#0b5e5a',
  primaryDark: '#6ee7d8',
  secondaryLight: '#e8732a',
  secondaryDark: '#ffb787',
};

export default (server, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',
  background: {
    default: darkMode ? '#0b1220' : '#f2f5f7',
    paper: darkMode ? '#121b2c' : '#ffffff',
  },
  primary: {
    main:
      validatedColor(server?.attributes?.colorPrimary) ||
      (darkMode ? brand.primaryDark : brand.primaryLight),
  },
  secondary: {
    main:
      validatedColor(server?.attributes?.colorSecondary) ||
      (darkMode ? brand.secondaryDark : brand.secondaryLight),
  },
  success: { main: darkMode ? '#4ade80' : '#15803d' },
  warning: { main: darkMode ? '#fbbf24' : '#d97706' },
  error: { main: darkMode ? '#f87171' : '#dc2626' },
  info: { main: darkMode ? '#7dd3fc' : '#0369a1' },
  text: {
    primary: darkMode ? '#e6edf5' : '#111827',
    secondary: darkMode ? '#9fb0c3' : '#5b6675',
  },
  divider: darkMode ? 'rgba(148, 163, 184, 0.16)' : 'rgba(17, 24, 39, 0.08)',
  neutral: {
    main: grey[500],
  },
  geometry: {
    main: '#3bb2d0',
  },
  alwaysDark: {
    main: grey[900],
  },
});
