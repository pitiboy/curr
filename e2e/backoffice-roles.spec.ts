import { test, expect } from '@playwright/test';

import {
  backofficeBase,
  backofficeRoute,
  fullStackSkipReason,
  fullStackUnreachableReason,
  isE2EBackofficeReachable,
  loginBackoffice,
  missingEditorEnv,
  missingFullStackEnv,
} from './backoffice-helpers';

// Sidebar entries are `menuitem`s; list-row CTAs are links (a disabled bulk-toolbar *button*
// shares the review label, so row CTAs are always looked up as links inside the table).
const REVIEW = /^Véglegesítés$/;
const FINALIZE = /^Véglegesít$/;
const DISCARD = /^Piszkozat törlése$/;

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
      { viaUi: true }, // the one real form login per run
    );

    await expect(
      page.getByRole('menuitem', { name: /^Új tranzakció$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('menuitem', { name: /^Tranzakciók$/ }),
    ).toBeVisible();
    await expect(page.getByRole('menuitem', { name: REVIEW })).toHaveCount(0);
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

    await page.goto(backofficeRoute('transactions/create'));
    // Exact name: the issues accordion header also starts with "Mentés".
    await expect(page.getByRole('button', { name: /^Mentés$/ })).toBeVisible({
      timeout: 20_000,
    });
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

    await page.goto(backofficeRoute('transactions'));
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

    await page.getByRole('menuitem', { name: REVIEW }).click();
    const reviewRow = page
      .getByRole('table')
      .getByRole('link', { name: REVIEW })
      .first();
    await expect(reviewRow).toBeVisible({ timeout: 20_000 });
    await reviewRow.click();

    await expect(page.getByRole('button', { name: FINALIZE })).toBeVisible();
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

    await page.getByRole('menuitem', { name: REVIEW }).click();
    await page
      .getByRole('table')
      .getByRole('link', { name: REVIEW })
      .first()
      .click();
    await expect(page.getByRole('button', { name: DISCARD })).toBeVisible();

    await loginBackoffice(
      page,
      process.env.E2E_DATAENTRY_EMAIL!,
      process.env.E2E_DATAENTRY_PASSWORD ?? '',
    );
    await page.goto(backofficeRoute('transactions'));
    await page
      .getByRole('table')
      .getByRole('link', { name: /^Megtekintés$/ })
      .first()
      .click();
    await expect(page.getByRole('button', { name: DISCARD })).toHaveCount(0);
    await expect(page.getByRole('button', { name: FINALIZE })).toHaveCount(0);
  });
});
