// Setup for component tests (FND-07). Files that render React start with
// `// @vitest-environment jsdom`; the rest keep running in node, where this file does nothing.
import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup, configure } = await import('@testing-library/react');
  // The first render of a file loads the theme and the translations; give it time.
  configure({ asyncUtilTimeout: 5000 });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  // jsdom has no layout: what MUI, react-window and the map code ask for.
  window.matchMedia ??= (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
  globalThis.ResizeObserver ??= class {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
  window.scrollTo ??= () => {};

  // The full-screen loader lives in index.html; <Loader /> shows and hides it.
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.style.display = 'none';
  document.body.append(loader);
}
