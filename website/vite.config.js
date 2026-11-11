import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {
  aqua,
  brandColors,
  motion,
  navy,
  radius,
  slate,
  status,
  type,
} from '../src/common/theme/tokens.js';

// Marketing site for viper fleet. A standalone build (website/dist) that shares the brand
// tokens and logo components with the app. Every color the site uses is emitted here as a CSS
// custom property from src/common/theme/tokens.js, so the stylesheet never holds a raw value.
// VIPER FLEET / SYNC POINT / MIDNIGHT AQUA - see BRAND.md.
const brandVars = () => {
  const vars = {
    '--navy': brandColors.navy,
    '--aqua': brandColors.aqua,
    '--ice': brandColors.ice,
    '--paper': brandColors.paper,
    '--ink': brandColors.ink,
    '--slate': brandColors.slate,
    '--white': brandColors.white,
    '--navy-950': navy[950],
    '--navy-850': navy[850],
    '--navy-700': navy[700],
    '--navy-600': navy[600],
    '--navy-300': navy[300],
    '--aqua-200': aqua[200],
    '--aqua-600': aqua[600],
    '--aqua-800': aqua[800],
    '--slate-200': slate[200],
    '--slate-300': slate[300],
    '--slate-600': slate[600],
    '--warning': status.light.warning,
    '--error': status.light.error,
    '--warning-dark': status.dark.warning,
    '--error-dark': status.dark.error,
    '--r-xs': `${radius.xs}px`,
    '--r-sm': `${radius.sm}px`,
    '--r-md': `${radius.md}px`,
    '--r-lg': `${radius.lg}px`,
    '--r-xl': `${radius.xl}px`,
    '--r-xxl': `${radius.xxl}px`,
    '--ease': motion.easing.standard,
    '--ease-emph': motion.easing.emphasized,
    '--font': type.fontFamily,
    '--font-he': type.hebrew,
  };
  return `:root{${Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')}}`;
};

// Warns during the build about settings that still need a value before going live.
const goLiveCheck = () => ({
  name: 'go-live-check',
  async buildStart() {
    const { site, screens } = await import('./src/config.js');
    if (!site.accessibility?.name || !(site.accessibility?.phone || site.accessibility?.email)) {
      this.warn(
        'site: accessibility coordinator not set; the accessibility statement has no contact (A11-07).',
      );
    }
    if (!site.leadEndpoint && !site.whatsapp && !site.contactEmail) {
      this.warn('site: no leadEndpoint, whatsapp or contactEmail; the demo form cannot send.');
    }
    const missing = Object.entries(screens).filter(([, screen]) => !screen.src);
    if (missing.length) {
      this.warn(
        `site: ${missing.length} screenshots missing (${missing.map(([k]) => k).join(', ')}).`,
      );
    }
  },
});

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  server: { port: 3100, host: true },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // A11-07: the accessibility statement is its own page.
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        accessibility: fileURLToPath(new URL('./accessibility.html', import.meta.url)),
      },
    },
  },
  plugins: [
    goLiveCheck(),
    {
      name: 'brand-vars',
      transformIndexHtml: (html) =>
        html
          .replace('<!--brand-vars-->', `<style>${brandVars()}</style>`)
          .replaceAll('${colorPrimary}', brandColors.navy),
    },
    react(),
  ],
});
