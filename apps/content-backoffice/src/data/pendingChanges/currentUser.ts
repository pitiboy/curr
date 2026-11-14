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

export function getPendingChangeUser(): PendingChangeUser | null {
  if (testUserOverride !== undefined) {
    return testUserOverride;
  }
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STRAPI_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as { id?: unknown; username?: unknown };
    if (typeof user.id !== 'number') return null;
    return {
      userId: user.id,
      username:
        typeof user.username === 'string' && user.username
          ? user.username
          : String(user.id),
    };
  } catch {
    return null;
  }
}
