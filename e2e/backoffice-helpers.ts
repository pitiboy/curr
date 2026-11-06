import net from 'node:net';

import type { Page } from '@playwright/test';

export const fullStackSkipReason =
  'Set .env.e2e from .env.e2e.example and start Strapi + dev:f';

/** When .env.e2e is set but `npm run dev:f` is not running (typical `npm run test:e2e` without stack). */
export function fullStackUnreachableReason(base: string): string {
  return `Full stack: backoffice not reachable at ${base}/login — start Vite (npm run dev:f, default port 5173) and Strapi (npm run dev), then rerun. Or run only login shell: npm run test:e2e -- --grep "login shell"`;
}

export function missingFullStackEnv(): boolean {
  return !process.env.E2E_DATAENTRY_EMAIL || !process.env.E2E_STRAPI_URL;
}

export function missingEditorEnv(): boolean {
  return !process.env.E2E_EDITOR_EMAIL || !process.env.E2E_STRAPI_URL;
}

export function backofficeBase(): string {
  return process.env.E2E_BACKOFFICE_URL ?? 'http://127.0.0.1:5173/backoffice';
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

/**
 * True if something accepts TCP on the backoffice URL's host:port.
 * Tries both 127.0.0.1 and ::1 when hostname is localhost (Vite may bind to one family only).
 */
export async function isE2EBackofficeReachable(): Promise<boolean> {
  const base = backofficeBase().trim().replace(/\/$/, '');
  const url = new URL(base.includes('://') ? base : `http://${base}`);
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 80;

  const timeoutMs = 4_000;

  if (url.hostname === 'localhost') {
    return (
      (await tcpConnect('127.0.0.1', port, timeoutMs)) ||
      (await tcpConnect('::1', port, timeoutMs))
    );
  }

  return tcpConnect(url.hostname, port, timeoutMs);
}

export async function loginBackoffice(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const base = backofficeBase();
  await page.goto(`${base}/login`);
  await page.getByRole('textbox', { name: /e-mail|email/i }).fill(email);
  // `getByLabel(/jelszó/)` matches MUI’s show-password button (“Jelszó megjelenítése”) — strict mode fails.
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /bejelentkezés|sign in/i }).click();
  await page.getByRole('navigation').waitFor({ state: 'visible', timeout: 20_000 });
}
