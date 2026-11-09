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
  const config = appConfig(env);
  return {
    ...config,
    server: { host: 'localhost', port: 3000 },
    plugins: [
      ...config.plugins,
      {
        name: 'demo-server',
        configureServer: demoServer,
        transformIndexHtml: (html) =>
          html
            .replaceAll('${title}', 'viper fleet demo')
            .replaceAll('${description}', 'viper fleet demo')
            .replaceAll('${colorPrimary}', '#102C54'),
      },
    ],
  };
});
