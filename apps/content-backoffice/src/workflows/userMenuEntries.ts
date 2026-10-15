export type UserMenuEntry = 'profile' | 'logout' | 'feature-flags';

export function userMenuEntries(metaKey: boolean): UserMenuEntry[] {
  if (metaKey) {
    return ['profile', 'logout', 'feature-flags'];
  }
  return ['profile', 'logout'];
}
