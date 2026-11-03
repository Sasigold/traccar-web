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
            .replaceAll('${title}', 'VIPER Demo')
            .replaceAll('${description}', 'VIPER Demo')
            .replaceAll('${colorPrimary}', '#1d4271'),
      },
    ],
  };
});
