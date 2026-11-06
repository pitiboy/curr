import net from 'node:net';

import { expect, type Page } from '@playwright/test';

import { E2E_SESSIONS_ENV, type E2ESession } from './global-setup';
import { backofficeBase } from './preview-url';

export { backofficeBase };

export const fullStackSkipReason =
  'Set .env.e2e from .env.e2e.example and start Strapi (npm run dev)';

/** When .env.e2e is set but the backoffice host:port is closed. */
export function fullStackUnreachableReason(base: string): string {
  return `Full stack: backoffice not reachable at ${base}/login — unset E2E_BACKOFFICE_URL to use Playwright's preview, or start npm run dev:f. Login shell only: npm run test:e2e -- --grep "login shell"`;
}

export function missingFullStackEnv(): boolean {
  return !process.env.E2E_DATAENTRY_EMAIL || !process.env.E2E_STRAPI_URL;
}

export function missingEditorEnv(): boolean {
  return !process.env.E2E_EDITOR_EMAIL || !process.env.E2E_STRAPI_URL;
}

/** react-admin uses a HashRouter: `/backoffice/transactions` would land on `#/` (the default list). */
export function backofficeRoute(route: string): string {
  return `${backofficeBase()}/#/${route.replace(/^\/+/, '')}`;
}

function tcpConnect(host: string, port: number, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(ms, () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

/** True if something accepts TCP on the backoffice URL's host:port. */
export async function isE2EBackofficeReachable(): Promise<boolean> {
  const url = new URL(backofficeBase());
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
  return tcpConnect(url.hostname, port, 4_000);
}

/** Session fetched by `global-setup.ts`; keys match ra-strapi (`strapiAuthStorage.ts`). */
function cachedSession(email: string): E2ESession | undefined {
  const all = JSON.parse(process.env[E2E_SESSIONS_ENV] ?? '{}') as Record<
    string,
    E2ESession
  >;
  return all[email];
}

/**
 * Logs in as `email` from a clean browser session. Reuses the API session from global setup
 * (avoids Strapi's auth rate limit); `viaUi: true` drives the real form, which is also the
 * fallback when no session is cached.
 */
export async function loginBackoffice(
  page: Page,
  email: string,
  password: string,
  { viaUi = false }: { viaUi?: boolean } = {},
): Promise<void> {
  if (!email.includes('@')) {
    // The input is type="email": native validation silently blocks submit → plain timeout.
    throw new Error(
      `E2E login "${email}" must be an email address, not a username.`,
    );
  }

  // Clear storage (previous user's token, persisted RA locale), then fully reload the login page.
  await page.context().clearCookies();
  await page.goto(`${backofficeBase()}/login`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  const submit = page.getByRole('button', { name: /^Bejelentkezés$/ });
  // Wait for the login page to settle: it calls authProvider.logout(), which would wipe a
  // token written earlier (→ anonymous requests → 403 → back to login).
  await expect(submit).toBeVisible();

  const session = viaUi ? undefined : cachedSession(email);
  if (session) {
    await page.evaluate(({ jwt, user }) => {
      localStorage.setItem('strapi_jwt', jwt);
      localStorage.setItem('strapi_user', JSON.stringify(user));
    }, session);
    await page.goto(backofficeRoute('transactions'));
  } else {
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    // `getByLabel(/jelszó/)` also matches MUI's show-password button.
    await page.locator('input[name="password"]').fill(password);
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/auth/local') &&
          r.request().method() === 'POST',
      ),
      submit.click(),
    ]);
    if (!res.ok()) {
      throw new Error(
        `Login failed: POST /api/auth/local → ${res.status()}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }

  // AppBar (`banner`) only renders when authenticated.
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 25_000 });
}
