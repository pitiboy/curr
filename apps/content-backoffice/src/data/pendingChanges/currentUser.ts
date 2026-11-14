import { STRAPI_USER_KEY } from '../../auth/strapiAuthStorage';

export type PendingChangeUser = {
  userId: number;
  username: string;
};

let testUserOverride: PendingChangeUser | null | undefined;

export function setTestPendingChangeUser(user: PendingChangeUser | null): void {
  testUserOverride = user;
}

export function clearTestPendingChangeUser(): void {
  testUserOverride = undefined;
}

function coerceUserId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getPendingChangeUser(): PendingChangeUser | null {
  if (testUserOverride !== undefined) {
    return testUserOverride;
  }
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STRAPI_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: unknown; username?: unknown };
    const userId = coerceUserId(user.id);
    if (userId == null) return null;
    return {
      userId,
      username:
        typeof user.username === 'string' && user.username
          ? user.username
          : String(userId),
    };
  } catch {
    return null;
  }
}
