import { test, expect } from '@playwright/test';

import {
  backofficeBase,
  fullStackSkipReason,
  fullStackUnreachableReason,
  isE2EBackofficeReachable,
  loginBackoffice,
  missingEditorEnv,
  missingFullStackEnv,
} from './backoffice-helpers';

test.describe('@full-stack', () => {
  let skipBecauseUnreachable = false;

  test.beforeAll(async () => {
    if (missingFullStackEnv()) return;
    skipBecauseUnreachable = !(await isE2EBackofficeReachable());
  });

  test('dataentry menu: create and list, no review menu @10.1', async ({
    page,
  }) => {
    test.skip(missingFullStackEnv(), fullStackSkipReason);
    test.skip(
      skipBecauseUnreachable,
      fullStackUnreachableReason(backofficeBase()),
    );

    await loginBackoffice(
      page,
      process.env.E2E_DATAENTRY_EMAIL!,
      process.env.E2E_DATAENTRY_PASSWORD ?? '',
    );

    const nav = page.getByRole('navigation');
    await expect(
      nav.getByRole('link', { name: /^Új tranzakció$/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: /^Tranzakciók$/i }),
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: /^Véglegesítés$/i }),
    ).toHaveCount(0);
  });

  test('dataentry can open create without publish @10.2', async ({ page }) => {
    test.skip(missingFullStackEnv(), fullStackSkipReason);
    test.skip(
      skipBecauseUnreachable,
      fullStackUnreachableReason(backofficeBase()),
    );

    await loginBackoffice(
      page,
      process.env.E2E_DATAENTRY_EMAIL!,
      process.env.E2E_DATAENTRY_PASSWORD ?? '',
    );

    await page.goto(`${backofficeBase()}/transactions/create`);
    await expect(page.getByRole('button', { name: /^mentés$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /véglegesít/i })).toHaveCount(
      0,
    );
  });

  test('transaction list is view-only for dataentry @10.6', async ({
    page,
  }) => {
    test.skip(missingFullStackEnv(), fullStackSkipReason);
    test.skip(
      skipBecauseUnreachable,
      fullStackUnreachableReason(backofficeBase()),
    );

    await loginBackoffice(
      page,
      process.env.E2E_DATAENTRY_EMAIL!,
      process.env.E2E_DATAENTRY_PASSWORD ?? '',
    );

    await page.goto(`${backofficeBase()}/transactions`);
    await expect(page.getByRole('table')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole('button', { name: /szerkesztés|edit/i }),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: /\/edit$/i })).toHaveCount(0);
  });

  test('editor can open review menu and sees finalize on draft show @10.5', async ({
    page,
  }) => {
    test.skip(missingEditorEnv(), fullStackSkipReason);
    test.skip(
      skipBecauseUnreachable,
      fullStackUnreachableReason(backofficeBase()),
    );

    await loginBackoffice(
      page,
      process.env.E2E_EDITOR_EMAIL!,
      process.env.E2E_EDITOR_PASSWORD ?? '',
    );

    await expect(
      page.getByRole('navigation').getByRole('link', {
        name: /^Véglegesítés$/i,
      }),
    ).toBeVisible();

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^Véglegesítés$/i })
      .click();
    await expect(page.getByRole('table')).toBeVisible({ timeout: 20_000 });

    const reviewRow = page
      .getByRole('button', { name: /^Véglegesítés$/i })
      .first();
    await expect(reviewRow).toBeVisible({ timeout: 20_000 });
    await reviewRow.click();

    await expect(
      page.getByRole('button', { name: /^Véglegesít$/i }),
    ).toBeVisible();
  });

  test('discard CTA only on editor draft show @10.11', async ({ page }) => {
    test.skip(missingEditorEnv(), fullStackSkipReason);
    test.skip(
      skipBecauseUnreachable,
      fullStackUnreachableReason(backofficeBase()),
    );

    await loginBackoffice(
      page,
      process.env.E2E_EDITOR_EMAIL!,
      process.env.E2E_EDITOR_PASSWORD ?? '',
    );

    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^Véglegesítés$/i })
      .click();
    await page
      .getByRole('button', { name: /^Véglegesítés$/i })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: /^Piszkozat törlése$/i }),
    ).toBeVisible();

    await loginBackoffice(
      page,
      process.env.E2E_DATAENTRY_EMAIL!,
      process.env.E2E_DATAENTRY_PASSWORD ?? '',
    );
    await page.goto(`${backofficeBase()}/transactions`);
    await page
      .getByRole('button', { name: /^Megtekintés$/i })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: /^Piszkozat törlése$/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Véglegesít$/i }),
    ).toHaveCount(0);
  });
});
