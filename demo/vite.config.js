import { defineConfig } from 'vite';
import appConfig from '../vite.config.js';
import { demoServer } from './server.js';

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
