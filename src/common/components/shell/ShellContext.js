import { createContext, use } from 'react';

const noop = () => {};

const ShellContext = createContext({
  paletteOpen: false,
  openPalette: noop,
  closePalette: noop,
  eventsOpen: false,
  openEvents: noop,
  closeEvents: noop,
  railCollapsed: false,
  toggleRail: noop,
  chromeVisible: true,
  openAssistant: null,
});

export const useShell = () => use(ShellContext);

export default ShellContext;
