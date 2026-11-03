import { useMemo } from 'react';
import { createTheme } from '@mui/material/styles';
import palette from './palette';
import dimensions from './dimensions';
import components from './components';

export const fontFamily =
  '"Heebo Variable", Heebo, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export default (server, darkMode, direction) =>
  useMemo(
    () =>
      createTheme({
        typography: {
          fontFamily,
          h5: { fontWeight: 700 },
          h6: { fontWeight: 700 },
          subtitle1: { fontWeight: 600 },
          button: { fontWeight: 600, textTransform: 'none' },
        },
        shape: {
          borderRadius: 12,
        },
        palette: palette(server, darkMode),
        direction,
        dimensions,
        components,
      }),
    [server, darkMode, direction],
  );
