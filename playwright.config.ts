import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

import { e2eStrapiUrl, PREVIEW_BACKOFFICE_URL } from './e2e/preview-url';

loadDotenv({ path: path.resolve(process.cwd(), '.env.e2e') });

const previewBase = `${PREVIEW_BACKOFFICE_URL}/`;

export default defineConfig({
  globalSetup: path.resolve(process.cwd(), 'e2e/global-setup.ts'),
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: previewBase,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'npm run build --prefix apps/content-backoffice && npm run preview:e2e --prefix apps/content-backoffice',
    url: `${previewBase}login`,
    // Reusing a running preview skips the build, so the bundle may lack VITE_STRAPI_URL. Opt in only.
    reuseExistingServer: process.env.E2E_REUSE_PREVIEW === '1',
    timeout: 300_000,
    // SPA is served from :4173, the API stays on :1337.
    env: { ...process.env, VITE_STRAPI_URL: e2eStrapiUrl() },
  },
});
