export const CONTENT_ROLES = ['dataentry', 'editor', 'controller'] as const;

export type ContentRole = (typeof CONTENT_ROLES)[number];

/** Roles with the full editor workflow (review, publish, convert, discard). */
export const EDITOR_LIKE_ROLES = ['editor', 'controller'] as const;

export function isContentRole(value: unknown): value is ContentRole {
  return (
    typeof value === 'string' &&
    (CONTENT_ROLES as readonly string[]).includes(value)
  );
}

/** `editor` or `controller` (React Admin `permissions` is the role type). */
export function isEditorLike(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (EDITOR_LIKE_ROLES as readonly string[]).includes(value)
  );
}

/** Controller only: delete expanded rows and purge an expansion. */
export function canPurgeExpansion(value: unknown): boolean {
  return value === 'controller';
}
