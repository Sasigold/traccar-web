import process from 'node:process';
import { defineConfig } from 'vite';
import appConfig from '../vite.config.js';
import { demoServer } from './server.js';

// FND-04: the demo never talks to a real fleet database. `.invalid` never resolves, so a request
// the e2e tests do not answer fails instead of reaching production. Set before Vite reads the
// environment, so it wins over any .env file.
export const DEMO_FLEET_URL = 'https://fleet.demo.invalid';
process.env.VITE_FLEET_URL = DEMO_FLEET_URL;
process.env.VITE_FLEET_ANON_KEY = 'demo-anon-key';
process.env.VITE_APP_ENV ||= 'demo';

export default defineConfig((env) => {
  // BRD-05: `npm run demo:il` (--mode il) serves the Israeli demo fleet.
  if (env.mode === 'il') process.env.DEMO_FLEET = 'il';
  const config = appConfig(env.mode === 'il' ? { ...env, mode: 'development' } : env);
  return {
    ...config,
    server: { host: 'localhost', port: 3000 },
    preview: { host: 'localhost', port: 3000 },
    plugins: [
      ...config.plugins,
      {
        name: 'demo-server',
        configureServer: demoServer,
        // FND-07: `vite preview` of a production build, with the same mock server, for the
        // performance profile (docs/PERFORMANCE.md).
        configurePreviewServer: demoServer,
        transformIndexHtml: (html) =>
          html
            .replaceAll('${title}', 'viper fleet demo')
            .replaceAll('${description}', 'viper fleet demo')
            .replaceAll('${colorPrimary}', '#102C54'),
      },
    ],
  };
});
