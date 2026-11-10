import { PAGE_FADE, beat } from '../../theme/motion';
import { motion } from '../../theme/tokens';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../LocalizationProvider';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import useFeatures from '../../util/useFeatures';
import usePersistedState from '../../util/usePersistedState';
import ShellContext from './ShellContext';
import NavRail from './NavRail';
import TopBar from './TopBar';
import MobileTabs from './MobileTabs';
import ShortcutsDialog from './ShortcutsDialog';
import AlertBanner from './AlertBanner';
import ImpersonationBanner from './ImpersonationBanner';
import { useAiAvailable } from '../../fleet/useAi';

// AI-01: loaded the first time it is opened.
const AssistantPanel = lazy(() => import('../assistant/AssistantPanel'));
// PRF-04: the search window and the alerts list are not in the first load, and the alerts list
// listens to the store only from the first time it is opened.
const loadPalette = () => import('./CommandPalette');
const loadEvents = () => import('./EventsDrawer');
const CommandPalette = lazy(loadPalette);
const EventsDrawer = lazy(loadEvents);
// Fetched once the app is idle; then the search window is mounted (closed), so the first Ctrl+K
// opens at once and keeps what is typed.
const whenIdle = (run) => {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = setTimeout(run, 1500);
  return () => clearTimeout(timer);
};

// True from the first time `open` is true (kept mounted afterwards, for the closing motion).
const useOpenedOnce = (open) => {
  const [opened, setOpened] = useState(open);
  if (open && !opened) {
    setOpened(true);
  }
  return opened || open;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
    [theme.breakpoints.up('md')]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'auto minmax(0, 1fr)',
    },
    '@media print': {
      display: 'block',
      height: 'auto',
    },
  },
  withRail: {
    [theme.breakpoints.up('md')]: {
      gridTemplateColumns: 'auto minmax(0, 1fr)',
    },
  },
  skip: {
    position: 'fixed',
    top: theme.spacing(1),
    insetInlineStart: theme.spacing(1),
    zIndex: theme.zIndex.tooltip,
    padding: theme.spacing(1, 2),
    borderRadius: theme.tokens.radius.pill,
    backgroundColor: theme.palette.cta.main,
    color: theme.palette.cta.contrastText,
    fontWeight: 600,
    textDecoration: 'none',
    transform: 'translateY(-200%)',
    '&:focus': {
      transform: 'none',
    },
    '@media print': {
      display: 'none',
    },
  },
  content: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    '@media print': {
      overflow: 'visible',
    },
  },
}));

const isEditable = (target) =>
  target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName || '');

const AppShell = ({ children }) => {
  const { classes, cx } = useStyles();
  const theme = useTheme();
  const features = useFeatures();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const chromeVisible = !features.disableTabs;

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [panelsLoaded, setPanelsLoaded] = useState(false);
  useEffect(
    () =>
      whenIdle(() => {
        Promise.all([loadPalette(), loadEvents()])
          .then(() => setPanelsLoaded(true))
          .catch(() => {});
      }),
    [],
  );
  const paletteMounted = useOpenedOnce(paletteOpen) || panelsLoaded;
  const eventsMounted = useOpenedOnce(eventsOpen);
  const [railCollapsed, setRailCollapsed] = usePersistedState('navRailCollapsed', false);
  const aiAvailable = useAiAvailable();
  const t = useTranslation();

  // LIV-16: after moving to another screen, the focus goes to its title, not the menu item.
  const { pathname } = useLocation();
  const firstRouteRef = useRef(true);
  useEffect(() => {
    if (firstRouteRef.current) {
      firstRouteRef.current = false;
      return undefined;
    }
    // BRD-03: a short fade between pages (180ms), without remounting the page.
    beat(document.getElementById('main-content'), PAGE_FADE, motion.duration.base);
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector('#main-content h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  // The assistant keeps its conversation while closed; null until first opened.
  const [assistant, setAssistant] = useState(null);
  const openAssistant = useCallback(
    (question) => setAssistant({ open: true, question: question || null }),
    [],
  );

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const openEvents = useCallback(() => setEventsOpen(true), []);
  const closeEvents = useCallback(() => setEventsOpen(false), []);
  const toggleRail = useCallback(() => setRailCollapsed((value) => !value), [setRailCollapsed]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // LIV-15: "?" opens the list of shortcuts.
      if (event.key === '?' && !isEditable(event.target) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      const key = event.key?.toLowerCase();
      const command = key === 'k' && (event.ctrlKey || event.metaKey);
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!command && !slash) return;
      if (slash && isEditable(event.target)) return;
      event.preventDefault();
      setPaletteOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const value = useMemo(
    () => ({
      paletteOpen,
      openPalette,
      closePalette,
      eventsOpen,
      openEvents,
      closeEvents,
      railCollapsed,
      toggleRail,
      chromeVisible,
      openAssistant: aiAvailable ? openAssistant : null,
    }),
    [
      paletteOpen,
      openPalette,
      closePalette,
      eventsOpen,
      openEvents,
      closeEvents,
      railCollapsed,
      toggleRail,
      chromeVisible,
      aiAvailable,
      openAssistant,
    ],
  );

  const showRail = desktop && chromeVisible;
  const showTabs = !desktop && chromeVisible;

  const railWidth = showRail
    ? railCollapsed
      ? theme.dimensions.railWidthCollapsed
      : theme.dimensions.railWidth
    : 0;

  const vars = {
    '--shell-rail': `${railWidth}px`,
    '--shell-top': `${desktop ? theme.dimensions.topBarHeight : theme.dimensions.topBarHeightMobile}px`,
    // Includes the iOS home-indicator inset, so everything anchored to the
    // bottom (FABs, snackbars, status card) clears it.
    '--shell-bottom': showTabs
      ? `calc(${theme.dimensions.mobileTabsHeight}px + env(safe-area-inset-bottom, 0px))`
      : 'env(safe-area-inset-bottom, 0px)',
  };

  return (
    <ShellContext value={value}>
      <div className={cx(classes.root, showRail && classes.withRail)} style={vars}>
        {/* LIV-16: the first stop of the keyboard. */}
        <a href="#main-content" className={classes.skip}>
          {t('shellSkipToContent')}
        </a>
        {showRail && <NavRail />}
        <TopBar />
        <ImpersonationBanner />
        <main
          id="main-content"
          tabIndex={-1}
          className={classes.content}
          style={showTabs ? undefined : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {children}
        </main>
        {showTabs && <MobileTabs />}
        {!features.disableEvents && eventsMounted && (
          <Suspense fallback={null}>
            <EventsDrawer open={eventsOpen} onClose={closeEvents} />
          </Suspense>
        )}
        {!features.disableEvents && (
          <AlertBanner
            // Clear of the alerts side panel while it is open on desktop.
            endInset={
              desktop && eventsOpen
                ? `calc(${theme.dimensions.eventsDrawerWidth} + ${theme.spacing(4)})`
                : 0
            }
          />
        )}
        {paletteMounted && (
          <Suspense fallback={null}>
            <CommandPalette open={paletteOpen} onClose={closePalette} />
          </Suspense>
        )}
        <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        {assistant && aiAvailable && (
          <Suspense fallback={null}>
            <AssistantPanel
              open={assistant.open}
              initialQuestion={assistant.question}
              onClose={() => setAssistant((current) => ({ ...current, open: false }))}
            />
          </Suspense>
        )}
      </div>
    </ShellContext>
  );
};

export default AppShell;
