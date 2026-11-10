import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './common/data/queryClient';
import { Provider } from 'react-redux';
import { CssBaseline, StyledEngineProvider } from '@mui/material';
import store from './store';
import { LocalizationProvider } from './common/components/LocalizationProvider';
import MessageHandler from './common/components/MessageHandler';
import Navigation from './Navigation';
import NativeInterface from './common/components/NativeInterface';
import ServerProvider from './ServerProvider';
import ErrorBoundary from './ErrorBoundary';
import AppThemeProvider from './AppThemeProvider';
import { installStaleBuildRecovery } from './common/util/staleBuild';
import { installTelemetry } from './common/telemetry/install';
import { installNumberInputGuards } from './common/util/numberInputs';
import TelemetryRoute from './common/telemetry/TelemetryRoute';
import { ConfirmProvider } from './common/components/confirm/ConfirmProvider';
import UnsavedChangesGuard from './common/components/confirm/UnsavedChangesGuard';
import Announcer from './common/components/Announcer';
import SelectionAnnouncer from './common/components/SelectionAnnouncer';

// FND-05: a tab from before a deploy reloads once instead of showing an error.
installStaleBuildRecovery();
// FND-06: error reports, web vitals, counters and analytics, each off unless the build sets it.
installTelemetry();
installNumberInputGuards();

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <LocalizationProvider>
          <StyledEngineProvider injectFirst>
            <AppThemeProvider>
              <CssBaseline enableColorScheme />
              <ConfirmProvider>
                <ServerProvider>
                  <BrowserRouter basename={new URL(document.baseURI).pathname}>
                    <TelemetryRoute />
                    <UnsavedChangesGuard />
                    <Navigation />
                    <MessageHandler />
                    <Announcer />
                    <SelectionAnnouncer />
                  </BrowserRouter>
                  <NativeInterface />
                </ServerProvider>
              </ConfirmProvider>
            </AppThemeProvider>
          </StyledEngineProvider>
        </LocalizationProvider>
      </QueryClientProvider>
    </Provider>
  </ErrorBoundary>,
);
