import { test as base, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

// Every page must reach "ready" without uncaught errors; collect them per test.
export const test = base.extend({
  pageErrors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
    },
    { auto: true },
  ],
});

export { expect };

// WCAG 2.1 AA (the level required by Israeli accessibility regulation, IS 5568).
export const axe = (page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Map tiles and third-party map labels are drawn by MapLibre, not by us.
    .exclude('.maplibregl-canvas')
    .exclude('.maplibregl-ctrl-attrib');

export const formatViolations = (violations) =>
  violations
    .map(
      (v) =>
        `${v.impact} ${v.id}: ${v.help}\n${v.nodes
          .slice(0, 5)
          .map((n) => `    ${n.target.join(' ')}`)
          .join('\n')}`,
    )
    .join('\n');

// Wait until the shell and the first data are on screen.
export const gotoReady = async (page, path) => {
  await page.goto(path);
  await expect(page.locator('#root')).not.toBeEmpty();
  await page.waitForLoadState('networkidle');
};
