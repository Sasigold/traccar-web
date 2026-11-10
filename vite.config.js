import { defineConfig, loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildEnvProblems } from './src/common/fleet/buildEnv.js';
import { releaseFile } from './src/common/util/release.js';
import { telemetryEnvProblems } from './src/common/telemetry/config.js';
import {
  contentSecurityPolicy,
  inlineScripts,
  scriptHash,
  securityHeaders,
} from './src/common/util/securityPolicy.js';

// FND-05: the build says which release it is, "1.0.0+<commit>", in the app (Preferences) and in
// version.json next to index.html (the deploy check reads it).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const commit = () => {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA;
  }
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

// Brand values baked into index.html and the PWA manifest at build time,
// so the UI looks right whether Traccar or a plain static server serves it.
// VIPER FLEET / SYNC POINT / MIDNIGHT AQUA - see BRAND.md.
const brand = {
  title: 'viper fleet',
  description: 'כל רכב. כל רגע. בתמונה אחת.',
  colorPrimary: '#102C54', // midnight navy
  background: '#F8FCFD', // paper
};

// ARC-12: what the service worker does not install up front (see workbox below).
const PRECACHE_SKIP = [/exceljs/, /StreamPage/, /^assets\/(ar|ru)-[\w-]{8}\.js$/];
// Map hosts whose styles, fonts and tiles may be kept on the device (Google, Bing, HERE, TomTom,
// Yandex and Mapbox are not: their terms limit caching).
const MAP_CACHE_HOSTS = [
  'tiles.openfreemap.org',
  'cdn.traccar.com',
  'tile.openstreetmap.org',
  'tiles.locationiq.com',
  'api.maptiler.com',
];
const MAP_TILE = /\/\d+\/\d+\/\d+(@\dx)?\.(pbf|mvt|png|jpe?g|webp)$/;

export default defineConfig(({ command, mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), 'VITE_');
  // FND-04: a production or staging build says which fleet database it talks to.
  // FND-06: and its error and analytics settings, when given, must be usable.
  if (command === 'build') {
    const problems = [...buildEnvProblems(mode, viteEnv), ...telemetryEnvProblems(viteEnv)];
    if (problems.length) {
      throw new Error(`Build environment (${mode}):\n- ${problems.join('\n- ')}`);
    }
  }
  const release = releaseFile({
    version: pkg.version,
    sha: commit(),
    environment: viteEnv.VITE_APP_ENV || mode,
    builtAt: new Date().toISOString(),
  });
  return {
    base: './',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(release.release),
    },
    server: {
      port: 3000,
      proxy: {
        '/api/socket': 'ws://localhost:8082',
        '/api': 'http://localhost:8082',
      },
    },
    test: {
      // *.test.jsx render components (React Testing Library, jsdom; FND-07).
      include: ['src/**/*.test.{js,jsx}', 'supabase/functions/**/*.test.js', 'demo/**/*.test.js'],
      setupFiles: ['src/test/setup.js'],
    },
    build: {
      outDir: 'build',
      // FND-06: with an error service, source maps are made for it but never linked from the
      // scripts; the deploy moves them out of build/ (they are uploaded to the error service, not
      // served), so stack traces are readable there and the source stays private.
      sourcemap: viteEnv.VITE_ERROR_DSN ? 'hidden' : false,
      // PRF-06: chunks load on demand (maplibre is the biggest); the first load has its own
      // budget, checked in CI (tools/size-budget.mjs).
      chunkSizeWarningLimit: 1100,
      rolldownOptions: {
        output: {
          // Long-lived vendor chunks: a UI deploy only invalidates our own code, so returning users
          // re-download a few hundred KB instead of the whole app. Only libraries the first screen
          // already needs go here; page-specific ones (charts, draw, excel, video) stay lazy.
          codeSplitting: {
            groups: [
              { name: 'maplibre', test: /node_modules[\\/]maplibre-gl[\\/]/, priority: 30 },
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|react-redux|@reduxjs|redux|immer|reselect|scheduler)[\\/]/,
                priority: 20,
              },
              {
                name: 'mui',
                // Components only some pages use stay with those pages (PRF-06: first-load budget).
                test: /node_modules[\\/](@mui[\\/](material(?![\\/](esm[\\/])?(Autocomplete|Slider|Stepper|Step|StepLabel|StepContent|StepButton|StepIcon|StepConnector|MobileStepper|Rating|SpeedDial|SpeedDialAction|SpeedDialIcon|Pagination|PaginationItem|TablePagination|ImageList|ImageListItem|ImageListItemBar|TableHead|TableSortLabel|TableContainer|TableFooter|Accordion|AccordionSummary|AccordionDetails|AccordionActions|Tabs|Tab|TabScrollButton|AvatarGroup|Radio|RadioGroup|Fab|LinearProgress)[\\/])|system|styled-engine|utils|private-theming)|@emotion|tss-react|stylis|stylis-plugin-rtl)[\\/]/,
                priority: 10,
              },
            ],
          },
        },
      },
    },
    plugins: [
      {
        name: 'brand-placeholders',
        transformIndexHtml: (html) =>
          html
            .replaceAll('${title}', brand.title)
            .replaceAll('${description}', brand.description)
            .replaceAll('${colorPrimary}', brand.colorPrimary),
      },
      svgr(),
      react(),
      // PRF-04: React Compiler, for the components that opt in with 'use memo' (the live
      // screen's rows, toolbar and cards), so a live update re-renders only what it changes.
      // Not the whole app: the compiler reads the property paths a closure uses (menu.latitude)
      // while rendering, to compare them, and code that is fine without it fails on null.
      babel({ presets: [reactCompilerPreset({ compilationMode: 'annotation' })] }),
      {
        // SEC-10: the Content-Security-Policy, with the hashes of the inline scripts of the
        // final index.html, as a <meta> tag (no server change needed), and security-headers.json
        // with every header for the reverse proxy (deploy/security-headers). Builds only: the
        // dev server injects its own scripts.
        name: 'security-policy',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            const scriptHashes = inlineScripts(html).map(scriptHash);
            this.emitFile?.({
              type: 'asset',
              fileName: 'security-headers.json',
              source: `${JSON.stringify(securityHeaders({ scriptHashes }), null, 2)}\n`,
            });
            return html.replace(
              '<meta charset="utf-8" />',
              `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy({ scriptHashes })}" />\n    <meta name="referrer" content="strict-origin" />`,
            );
          },
        },
      },
      {
        name: 'release-file',
        apply: 'build',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: `${JSON.stringify(release, null, 2)}\n`,
          });
        },
      },
      VitePWA({
        injectRegister: false,
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        workbox: {
          // The service worker is ours to debug locally; no map is shipped for it (FND-06).
          sourcemap: false,
          navigateFallbackDenylist: [/\/api(\/|$)/],
          globPatterns: ['**/*.{js,css,html,woff,woff2,mp3}'],
          // ARC-12: the install holds the shell and the everyday screens. What few people
          // open (Excel export, video, Arabic and Russian) is fetched
          // the first time and kept (runtimeCaching below).
          manifestTransforms: [
            async (entries) => ({
              manifest: entries.filter(
                (entry) => !PRECACHE_SKIP.some((test) => test.test(entry.url)),
              ),
              warnings: [],
            }),
          ],
          runtimeCaching: [
            {
              // Build files have the content hash in the name: once fetched, never again.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/assets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'vf-assets',
                expiration: { maxEntries: 150, maxAgeSeconds: 60 * 24 * 3600 },
              },
            },
            {
              // Map styles, sprites and fonts: shown from the cache, refreshed behind it.
              urlPattern: ({ url }) =>
                MAP_CACHE_HOSTS.includes(url.hostname) && !MAP_TILE.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'vf-map-style',
                expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Map tiles of the providers whose terms allow keeping them, two weeks at most.
              urlPattern: ({ url }) =>
                MAP_CACHE_HOSTS.includes(url.hostname) && MAP_TILE.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'vf-map-tiles',
                expiration: {
                  maxEntries: 3000,
                  maxAgeSeconds: 14 * 24 * 3600,
                  purgeOnQuotaError: true,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          short_name: brand.title,
          // BRD-06: the name is lowercase everywhere, the install screen included.
          name: 'viper fleet',
          description: brand.description,
          theme_color: brand.colorPrimary,
          background_color: brand.background,
          lang: 'he',
          dir: 'rtl',
          icons: [
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
      viteStaticCopy({
        targets: [
          // stripBase: static-copy v4 keeps the source folder structure by default, which put the
          // plugin under build/node_modules/... and broke Hebrew map labels.
          {
            src: 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js',
            dest: '',
            rename: { stripBase: true },
          },
        ],
      }),
    ],
  };
});
