import { config as loadDotenv } from 'dotenv';
import path from 'node:path';

/**
 * Runs once in the main Playwright process so `.env.e2e` is visible to all workers
 * (worker processes do not re-execute playwright.config imports the same way).
 */
export default async function globalSetup(): Promise<void> {
  loadDotenv({ path: path.resolve(process.cwd(), '.env.e2e') });
}
