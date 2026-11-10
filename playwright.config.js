import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

// End-to-end and accessibility checks against the built-in demo server (`npm run demo`).
// Set PW_CHROMIUM_PATH to reuse a preinstalled Chromium instead of `npx playwright install`.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'en-US',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /performance\.spec\.js/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /performance\.spec\.js/ },
    // FND-07: the 2,000-vehicle profile runs last and alone, so other tests do not skew it.
    {
      name: 'performance',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testMatch: /performance\.spec\.js/,
      dependencies: ['desktop', 'mobile'],
    },
  ],
  webServer: {
    command: 'npm run demo',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
