import { test, expect } from '@playwright/test';

test.describe('login shell', () => {
  test('shows Hungarian email login and Google entry @10.1', async ({ page }) => {
    await page.goto('login');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /google/i }),
    ).toBeVisible();
  });
});

test.describe('@full-stack', () => {
  test.skip(
    !process.env.E2E_DATAENTRY_EMAIL || !process.env.E2E_STRAPI_URL,
    'Set .env.e2e from .env.e2e.example and start Strapi + dev:f',
  );

  test('dataentry can open create without publish @10.2', async ({ page }) => {
    const base =
      process.env.E2E_BACKOFFICE_URL ?? 'http://127.0.0.1:5173/backoffice';
    await page.goto(`${base}/login`);
    await page.getByLabel(/e-mail/i).fill(process.env.E2E_DATAENTRY_EMAIL!);
    await page.getByLabel(/jelszó|password/i).fill(
      process.env.E2E_DATAENTRY_PASSWORD!,
    );
    await page.getByRole('button', { name: /bejelentkezés|sign in/i }).click();
    await page.goto(`${base}/transactions/create`);
    await expect(
      page.getByRole('button', { name: /^mentés$/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /véglegesít/i })).toHaveCount(
      0,
    );
  });
});
