import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { createAppStore } from '../store';
import { LocalizationProvider } from '../common/components/LocalizationProvider';
import AppThemeProvider from '../AppThemeProvider';

// Where the router is, for tests that check a navigation.
export const location = { current: null };
const LocationProbe = () => {
  location.current = useLocation();
  return null;
};

// Renders a piece of the app the way index.jsx does: store, Hebrew translations, the RTL theme
// and a router. `path` is the route pattern (for useParams), `route` the address opened.
// `state` is merged onto the app's initial state, slice by slice.
export const appState = (state = {}) => {
  const initial = createAppStore().getState();
  return Object.fromEntries(
    Object.entries(initial).map(([slice, value]) => [slice, { ...value, ...state[slice] }]),
  );
};

// Async: the translations suspend the first render, and React retries it inside act.
export const renderApp = async (ui, { state, route = '/', path = '*', history = [] } = {}) => {
  const store = createAppStore(appState(state));
  const user = userEvent.setup();
  let result;
  await act(async () => {
    result = render(
      <Provider store={store}>
        <LocalizationProvider>
          <AppThemeProvider>
            <MemoryRouter initialEntries={[...history, route]} initialIndex={history.length}>
              <LocationProbe />
              <Routes>
                <Route path={path} element={ui} />
                <Route path="*" element={<div data-testid="elsewhere" />} />
              </Routes>
            </MemoryRouter>
          </AppThemeProvider>
        </LocalizationProvider>
      </Provider>,
    );
  });
  return { ...result, store, user };
};

// A fetch that answers from a table of handlers: { 'GET api/devices': [..] } or a function
// (url, init) => body | Response. Unknown requests fail the test loudly.
export const fakeFetch = (handlers) => {
  const calls = [];
  const fetch = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    calls.push({ method, url, body: init.body });
    const key = Object.keys(handlers).find((pattern) => {
      const [m, path] = pattern.split(' ');
      return m === method && (url === path || url.startsWith(`${path}?`));
    });
    if (!key) {
      throw new Error(`Unexpected request: ${method} ${url}`);
    }
    let body = handlers[key];
    if (typeof body === 'function') {
      body = await body(url, init);
    }
    if (body instanceof Response) {
      return body;
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fetch, calls };
};
