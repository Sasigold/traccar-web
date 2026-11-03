import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Brand values baked into index.html and the PWA manifest at build time,
// so the UI looks right whether Traccar or a plain static server serves it.
const brand = {
  title: 'ניהול צי',
  description: 'מרכז שליטה ובקרה לצי הרכב',
  colorPrimary: '#4f46e5',
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
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      workbox: {
        navigateFallbackDenylist: [/\/api(\/|$)/],
        globPatterns: ['**/*.{js,css,html,woff,woff2,mp3}'],
      },
      manifest: {
        short_name: brand.title,
        name: brand.description,
        theme_color: brand.colorPrimary,
        background_color: '#f4f6fb',
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
            purpose: 'any maskable',
          },
        ],
      },
    }),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js', dest: '' },
      ],
    }),
  ],
}));
