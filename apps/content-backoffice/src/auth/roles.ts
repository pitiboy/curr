export const CONTENT_ROLES = ['dataentry', 'editor', 'controller'] as const;

export type ContentRole = (typeof CONTENT_ROLES)[number];

/** Editor workflow: review, publish, convert, discard (controller includes these). */
export const EDITOR_LIKE_ROLES = ['editor', 'controller'] as const;

export type EditorLikeRole = (typeof EDITOR_LIKE_ROLES)[number];

export function isContentRole(value: unknown): value is ContentRole {
  return (
    typeof value === 'string' &&
    (CONTENT_ROLES as readonly string[]).includes(value)
  );
}

export function isEditorLikeRole(value: unknown): value is EditorLikeRole {
  return (
    typeof value === 'string' &&
    (EDITOR_LIKE_ROLES as readonly string[]).includes(value)
  );
}

/** Whether `role` is allowed by a role list that may name `editor` for both editor-like roles. */
export function roleAllowed(allowed: readonly string[], role: string): boolean {
  if (allowed.includes(role)) return true;
  return isEditorLikeRole(role) && allowed.includes('editor');
}

/** Controller-only: expanded/storno purge and general delete. */
export function canPurgeExpansion(value: unknown): boolean {
  return value === 'controller';
}
