import { config as loadDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import { e2eStrapiUrl } from './preview-url';

export type E2ESession = { jwt: string; user: unknown };

/** Env var carrying `{ [email]: E2ESession }` to the workers. */
export const E2E_SESSIONS_ENV = 'E2E_SESSIONS_JSON';

/** Kept across runs (JWTs live ~30 days), so re-runs do not spend the auth rate limit. */
const SESSION_CACHE = path.resolve(
  process.cwd(),
  'node_modules/.cache/e2e/sessions.json',
);

function readCache(): Record<string, E2ESession> {
  try {
    return JSON.parse(fs.readFileSync(SESSION_CACHE, 'utf8'));
  } catch {
    return {};
  }
}

/** `/api/users/me` is not rate-limited. */
async function isValid(strapi: string, session: E2ESession): Promise<boolean> {
  const res = await fetch(`${strapi}/api/users/me`, {
    headers: { Authorization: `Bearer ${session.jwt}` },
  });
  return res.ok;
}

async function apiLogin(
  strapi: string,
  identifier: string,
  password: string,
): Promise<E2ESession | undefined> {
  const res = await fetch(`${strapi}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    console.warn(
      `[e2e] API login ${identifier} → ${res.status}; falling back to UI login.`,
    );
    return undefined;
  }
  const { jwt, user } = (await res.json()) as E2ESession;
  return { jwt, user };
}

/**
 * Runs once in the main Playwright process: loads `.env.e2e` for all workers, and provides one
 * API session per e2e user. Strapi rate-limits POST /api/auth/local to 10/min per IP (shared by
 * all users), so a UI login in every test would hit 429. Workers inherit env vars set here.
 */
export default async function globalSetup(): Promise<void> {
  loadDotenv({ path: path.resolve(process.cwd(), '.env.e2e') });
  if (!process.env.E2E_STRAPI_URL) return;

  const strapi = e2eStrapiUrl();
  const users = [
    [process.env.E2E_DATAENTRY_EMAIL, process.env.E2E_DATAENTRY_PASSWORD],
    [process.env.E2E_EDITOR_EMAIL, process.env.E2E_EDITOR_PASSWORD],
  ] as const;

  const cached = readCache();
  const sessions: Record<string, E2ESession> = {};
  try {
    for (const [email, password = ''] of users) {
      if (!email) continue;
      const session =
        cached[email] && (await isValid(strapi, cached[email]))
          ? cached[email]
          : await apiLogin(strapi, email, password);
      if (session) sessions[email] = session;
    }
  } catch (error) {
    console.warn(`[e2e] Strapi not reachable at ${strapi}: ${String(error)}`);
  }

  process.env[E2E_SESSIONS_ENV] = JSON.stringify(sessions);
  fs.mkdirSync(path.dirname(SESSION_CACHE), { recursive: true });
  fs.writeFileSync(SESSION_CACHE, JSON.stringify(sessions));
}
