import { test, expect, gotoReady } from './fixtures';

// LIV-20: the sign-in screen: left-to-right fields, a failure that is read out, a one-time
// code field for phones, a page heading, and a reset link that always leads somewhere.
test.describe('sign in', () => {
  test('a failed sign-in, then a one-time code', async ({ page }) => {
    let answer = 'wrong';
    await page.route('**/api/session', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      if (answer === 'wrong') return route.fulfill({ status: 401, body: '' });
      return route.fulfill({ status: 401, headers: { 'WWW-Authenticate': 'TOTP' }, body: '' });
    });
    await gotoReady(page, '/login');
    await expect(page.getByRole('heading', { level: 1, name: 'ברוכים השבים' })).toBeVisible();

    const email = page.getByRole('textbox', { name: 'אימייל' });
    await expect(email).toHaveAttribute('dir', 'ltr');
    await email.fill('dana@example.com');
    const password = page.locator('input[name=password]');
    await expect(password).toHaveAttribute('dir', 'ltr');
    await password.fill('secret');
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.getByRole('alert')).toHaveText('אימייל או סיסמה שגויים');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(password).toHaveAttribute('aria-invalid', 'true');

    answer = 'totp';
    await page.getByRole('button', { name: 'כניסה' }).click();
    const code = page.getByRole('textbox', { name: /קוד/ });
    await expect(code).toBeFocused();
    await expect(code).toHaveAttribute('inputmode', 'numeric');
    await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    await code.pressSequentially('12a34');
    await expect(code).toHaveValue('1234');
  });

  test('the reset link explains whom to ask when the server sends no e-mail', async ({ page }) => {
    await gotoReady(page, '/login');
    await page.getByRole('button', { name: 'איפוס סיסמה' }).click();
    await expect(page.getByText(/פנו למנהל החשבון/)).toBeVisible();
  });
});

// SEC-20: a link with a token asks before it replaces the user signed in now.
test('a token link asks before replacing a signed-in session', async ({ page }) => {
  const exchanged = [];
  await page.route('**/api/session?token=*', (route) => {
    exchanged.push(route.request().url());
    return route.fallback();
  });
  await gotoReady(page, '/');
  await page.goto('/?token=abc');
  const dialog = page.getByRole('dialog', { name: 'להחליף את המשתמש המחובר?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'ביטול' }).click();
  await expect(page).not.toHaveURL(/token=/);
  expect(exchanged).toEqual([]);
});
