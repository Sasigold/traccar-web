import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Brand values baked into index.html and the PWA manifest at build time,
// so the UI looks right whether Traccar or a plain static server serves it.
// VIPER FLEET / SYNC POINT / MIDNIGHT AQUA - see BRAND.md.
const brand = {
  title: 'viper fleet',
  description: 'כל רכב. כל רגע. בתמונה אחת.',
  colorPrimary: '#102C54', // midnight navy
  background: '#F8FCFD', // paper
};

export default defineConfig(() => ({
  base: './',
  server: {
    port: 3000,
    proxy: {
      '/api/socket': 'ws://localhost:8082',
      '/api': 'http://localhost:8082',
    },
  },
  build: {
    outDir: 'build',
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
              test: /node_modules[\\/](@mui[\\/](material|system|styled-engine|utils|private-theming)|@emotion|tss-react|stylis|stylis-plugin-rtl)[\\/]/,
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
    VitePWA({
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      workbox: {
        navigateFallbackDenylist: [/\/api(\/|$)/],
        globPatterns: ['**/*.{js,css,html,woff,woff2,mp3}'],
      },
      manifest: {
        short_name: brand.title,
        name: 'VIPER FLEET',
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
}));
