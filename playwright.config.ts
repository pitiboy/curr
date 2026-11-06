import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

loadDotenv({ path: path.resolve(process.cwd(), '.env.e2e') });

const previewPort = 4173;
// Use IPv4 loopback: on some systems `localhost` resolves to ::1 first while Vite binds 127.0.0.1 only.
const previewBase = `http://127.0.0.1:${previewPort}/backoffice/`;

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
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
