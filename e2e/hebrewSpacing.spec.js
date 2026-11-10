import { test, expect, gotoReady } from './fixtures';

// A11-11 (BRAND §5): no spaced-out capitals on Hebrew text. Any element whose own text is Hebrew
// must have no positive letter spacing and no text transform.
const spacedHebrew = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((element) => {
        const own = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join('');
        if (!/[֐-׿]/.test(own)) return false;
        const style = getComputedStyle(element);
        const spacing = parseFloat(style.letterSpacing);
        return (Number.isFinite(spacing) && spacing > 0.1) || style.textTransform === 'uppercase';
      })
      .map((element) => `${element.tagName}.${element.className}: ${element.textContent.trim()}`),
  );

for (const path of ['/dashboard', '/settings/drivers', '/replay']) {
  test(`Hebrew text is not letter-spaced on ${path}`, async ({ page }) => {
    await gotoReady(page, path);
    await page.waitForTimeout(800);
    expect(await spacedHebrew(page)).toEqual([]);
  });
}
