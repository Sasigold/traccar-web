import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import useFeatures from '../../util/useFeatures';
import usePersistedState from '../../util/usePersistedState';
import ShellContext from './ShellContext';
import NavRail from './NavRail';
import TopBar from './TopBar';
import MobileTabs from './MobileTabs';
import CommandPalette from './CommandPalette';
import ShortcutsDialog from './ShortcutsDialog';
import EventsDrawer from './EventsDrawer';
import AlertBanner from './AlertBanner';
import ImpersonationBanner from './ImpersonationBanner';
import { useAiAvailable } from '../../fleet/useAi';

// AI-01: loaded the first time it is opened.
const AssistantPanel = lazy(() => import('../assistant/AssistantPanel'));

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
  const [railCollapsed, setRailCollapsed] = usePersistedState('navRailCollapsed', false);
  const aiAvailable = useAiAvailable();
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
        {showRail && <NavRail />}
        <TopBar />
        <ImpersonationBanner />
        <main
          className={classes.content}
          style={showTabs ? undefined : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {children}
        </main>
        {showTabs && <MobileTabs />}
        {!features.disableEvents && <EventsDrawer open={eventsOpen} onClose={closeEvents} />}
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
        <CommandPalette open={paletteOpen} onClose={closePalette} />
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
