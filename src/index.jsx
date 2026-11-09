import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
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
import TelemetryRoute from './common/telemetry/TelemetryRoute';
import { ConfirmProvider } from './common/components/confirm/ConfirmProvider';
import UnsavedChangesGuard from './common/components/confirm/UnsavedChangesGuard';

// FND-05: a tab from before a deploy reloads once instead of showing an error.
installStaleBuildRecovery();
// FND-06: error reports, web vitals, counters and analytics, each off unless the build sets it.
installTelemetry();

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <Provider store={store}>
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
                </BrowserRouter>
                <NativeInterface />
              </ServerProvider>
            </ConfirmProvider>
          </AppThemeProvider>
        </StyledEngineProvider>
      </LocalizationProvider>
    </Provider>
  </ErrorBoundary>,
);
