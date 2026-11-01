import { defineConfig, devices } from '@playwright/test';

const previewPort = 4173;
const previewBase = `http://localhost:${previewPort}/backoffice/`;

export default defineConfig({
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
    timeout: 180_000,
  },
});
