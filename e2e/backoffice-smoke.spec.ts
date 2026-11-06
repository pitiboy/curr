import { test, expect } from '@playwright/test';

test.describe('login shell', () => {
  test('shows Hungarian email login and Google entry @10.1', async ({ page }) => {
    await page.goto('login');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /google/i }),
    ).toBeVisible();
  });

  test('shows Hungarian login copy on the shell @10.8', async ({ page }) => {
    await page.goto('login');
    await expect(
      page.getByRole('button', { name: 'Bejelentkezés', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /email/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /^jelszó$/i }),
    ).toBeVisible();
  });
});
